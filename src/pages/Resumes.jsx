import React, { useEffect, useMemo, useState } from "react";
import styles from "./Resumes.module.css";
import shell from "../App.module.css";
import { useAuth } from "../auth/AuthProvider";
import ResumeAnalysisPanel from "../components/ResumeAnalysisPanel";
import ResumeUploadModal from "../components/ResumeUploadModal";
import { subscribeToApplications } from "../services/applications";
import { analyzeResume, setResumeAnalysisFeedback } from "../services/resumeAnalysis";
import {
  deleteResumeAndUnlinkApplications,
  renameResume,
  subscribeToResumes
} from "../services/resumes";
import { computeResumePerformance } from "../services/resumePerformance";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function formatBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let v = n;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx += 1;
  }
  return `${v.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export default function Resumes() {
  const { user } = useAuth();
  const [resumes, setResumes] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [error, setError] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [hoveredAiId, setHoveredAiId] = useState("");
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisResumeId, setAnalysisResumeId] = useState("");
  const [analysisBusyById, setAnalysisBusyById] = useState(() => new Map());
  const [analysisErrorById, setAnalysisErrorById] = useState(() => new Map());

  useEffect(() => {
    if (!user?.uid) return;
    setLoadingResumes(true);
    setError("");
    const unsub = subscribeToResumes(
      user.uid,
      (rows) => {
        setResumes(rows);
        setLoadingResumes(false);
      },
      (err) => {
        setError(err?.message || "Failed to load resumes.");
        setResumes([]);
        setLoadingResumes(false);
      }
    );
    return () => unsub();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsub = subscribeToApplications(
      user.uid,
      (rows) => setApplications(rows),
      () => setApplications([])
    );
    return () => unsub();
  }, [user?.uid]);

  const perf = useMemo(() => computeResumePerformance(resumes, applications), [resumes, applications]);

  const legacyResumeLabels = useMemo(() => {
    const set = new Set();
    (applications || []).forEach((a) => {
      if (a?.resumeVersionId) return;
      const label = String(a?.resumeVersion || "").trim();
      if (label) set.add(label);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [applications]);

  const rows = useMemo(() => {
    return (resumes || []).map((r) => {
      const p = perf.byId.get(r.id);
      const count = p?.applications ?? 0;
      const rate = p?.responseRate;
      const isBest = perf.bestResumeId && perf.bestResumeId === r.id;
      return {
        ...r,
        appsCount: count,
        responseRate: rate,
        isBest
      };
    });
  }, [resumes, perf]);

  const analysisResume = useMemo(() => {
    return (rows || []).find((r) => r.id === analysisResumeId) || null;
  }, [rows, analysisResumeId]);

  async function handleDelete(resume) {
    const count = perf.byId.get(resume.id)?.applications ?? 0;
    const ok = window.confirm(
      `Delete "${resume.versionName || "this resume"}"?\n\nThis will unlink it from ${count} application(s). Those applications will keep a legacy text label.`
    );
    if (!ok) return;
    setError("");
    try {
      await deleteResumeAndUnlinkApplications(user.uid, resume);
    } catch (err) {
      setError(err?.message || "Failed to delete resume.");
    }
  }

  async function handleRename(resume) {
    const next = window.prompt("Rename resume", resume.versionName || "");
    if (next == null) return;
    setError("");
    try {
      await renameResume(user.uid, resume.id, next);
    } catch (err) {
      setError(err?.message || "Failed to rename resume.");
    }
  }

  async function handleOpenAnalysis(resume) {
    if (!resume?.id) return;
    setAnalysisResumeId(resume.id);
    setAnalysisOpen(true);

    const hasCached = Boolean(resume.analysisResult && resume.analyzedAt);
    if (hasCached) return;

    const busy = analysisBusyById.get(resume.id);
    if (busy) return;

    setAnalysisErrorById((prev) => {
      const next = new Map(prev);
      next.delete(resume.id);
      return next;
    });
    setAnalysisBusyById((prev) => {
      const next = new Map(prev);
      next.set(resume.id, true);
      return next;
    });

    try {
      await analyzeResume(resume.id);
    } catch (err) {
      const msg = err?.message || "Resume analysis failed. Please try again.";
      setAnalysisErrorById((prev) => {
        const next = new Map(prev);
        next.set(resume.id, msg);
        return next;
      });
    } finally {
      setAnalysisBusyById((prev) => {
        const next = new Map(prev);
        next.delete(resume.id);
        return next;
      });
    }
  }

  async function handleFeedback(resumeId, value) {
    try {
      await setResumeAnalysisFeedback(resumeId, value);
    } catch {
      // ignore; UI will reflect latest from subscription when possible
    }
  }

  return (
    <>
      <div className={shell.pgHeader}>
        <div className={shell.pgTitle}>Resumes</div>
        <div className={shell.pgActions}>
          <button
            className={shell.primaryButton}
            onClick={() => setUploadOpen(true)}
            type="button"
          >
            + Upload Resume
          </button>
        </div>
      </div>

      <div className={shell.pgBody}>
        {error ? <div className={shell.errorBanner}>{error}</div> : null}

        {legacyResumeLabels.length > 0 ? (
          <div className={styles.legacyBanner}>
            <div className={styles.legacyTitle}>Legacy resume labels found</div>
            <div className={styles.legacySub}>
              {legacyResumeLabels.length} label(s) exist on older applications. Upload a resume file
              and select it in those applications to start tracking performance.
            </div>
          </div>
        ) : null}

        {loadingResumes ? (
          <div className={styles.loading}>
            <div className={styles.loadingTitle}>Loading resumes…</div>
            <div className={styles.loadingSub}>Fetching from Firestore</div>
          </div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No resumes yet</div>
            <div className={styles.emptySub}>Upload your first resume to get started.</div>
            <button className={styles.emptyButton} onClick={() => setUploadOpen(true)}>
              + Upload Resume
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {rows.map((r) => (
              <ResumeCard
                key={r.id}
                r={r}
                hoveredAiId={hoveredAiId}
                setHoveredAiId={setHoveredAiId}
                analysisBusyById={analysisBusyById}
                analysisErrorById={analysisErrorById}
                onAnalysis={handleOpenAnalysis}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      <ResumeUploadModal
        open={uploadOpen}
        resumes={resumes}
        onClose={() => setUploadOpen(false)}
        onUploaded={() => {}}
      />

      <ResumeAnalysisPanel
        open={analysisOpen}
        title={analysisResume?.versionName || analysisResume?.fileName || "Resume"}
        analysisResult={analysisResume?.analysisResult || null}
        analyzedAt={analysisResume?.analyzedAt || null}
        loading={analysisResumeId ? Boolean(analysisBusyById.get(analysisResumeId)) : false}
        error={analysisResumeId ? analysisErrorById.get(analysisResumeId) || "" : ""}
        feedback={analysisResume?.feedback || null}
        onClose={() => setAnalysisOpen(false)}
        onFeedback={(value) => {
          if (!analysisResumeId) return;
          handleFeedback(analysisResumeId, value);
        }}
      />
    </>
  );
}

function ResumeCard({
  r,
  hoveredAiId,
  setHoveredAiId,
  analysisBusyById,
  analysisErrorById,
  onAnalysis,
  onRename,
  onDelete
}) {
  return (
    <div className={`${styles.card} ${r.isBest ? styles.cardBest : ""}`}>
      {/* Document preview area */}
      <div className={styles.cardPreview}>
        <svg width="32" height="38" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M2 2h18l10 10v24a2 2 0 01-2 2H2a2 2 0 01-2-2V4a2 2 0 012-2z" fill="rgba(255,255,255,0.04)" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2"/>
          <path d="M20 2v10h10" stroke="rgba(255,255,255,0.12)" strokeWidth="1.2"/>
          <rect x="5" y="16" width="16" height="1.2" rx="0.6" fill="rgba(255,255,255,0.1)"/>
          <rect x="5" y="20" width="12" height="1.2" rx="0.6" fill="rgba(255,255,255,0.07)"/>
          <rect x="5" y="24" width="18" height="1.2" rx="0.6" fill="rgba(255,255,255,0.1)"/>
          <rect x="5" y="28" width="10" height="1.2" rx="0.6" fill="rgba(255,255,255,0.07)"/>
        </svg>
        <div className={styles.cardFileType}>
          {r.fileType ? r.fileType.split("/").pop()?.toUpperCase() : "PDF"}
        </div>
        {r.isBest ? <span className={styles.bestBadge}>Best</span> : null}
      </div>

      {/* Info section */}
      <div className={styles.cardInfo}>
        <div className={styles.cardName}>
          {r.versionName || "Untitled resume"}
          <span
            className={styles.aiWrap}
            onMouseEnter={() => setHoveredAiId(r.id)}
            onMouseLeave={() => setHoveredAiId("")}
          >
            <button
              className={[
                styles.aiBadge,
                r.analysisResult ? styles.aiBadgeReady : "",
                analysisBusyById.get(r.id) ? styles.aiBadgeBusy : ""
              ].join(" ")}
              type="button"
              onClick={() => onAnalysis(r)}
              aria-busy={analysisBusyById.get(r.id) ? "true" : "false"}
              aria-label={
                r.analysisResult ? "Open AI analysis" : "Analyze this resume with AI"
              }
            >
              AI
            </button>
            {hoveredAiId === r.id ? (
              <div className={styles.aiTooltip} role="tooltip">
                <div className={styles.aiTooltipTitle}>
                  {analysisBusyById.get(r.id)
                    ? "Analyzing…"
                    : r.analysisResult
                      ? "AI Summary"
                      : "AI Analysis"}
                </div>
                <div
                  className={[
                    styles.aiTooltipBody,
                    analysisErrorById.get(r.id) ? styles.aiTooltipError : ""
                  ].join(" ")}
                >
                  {analysisErrorById.get(r.id)
                    ? analysisErrorById.get(r.id)
                    : analysisBusyById.get(r.id)
                      ? "Extracting text and generating insights."
                      : r.analysisResult?.summary
                        ? r.analysisResult.summary
                        : "Click to generate an AI assessment."}
                </div>
              </div>
            ) : null}
          </span>
        </div>
        <div className={styles.cardMeta}>{r.fileName || "—"}</div>

        <div className={styles.cardStats}>
          <div className={styles.cardStat}>
            <div className={styles.cardStatValue}>{r.appsCount}</div>
            <div className={styles.cardStatLabel}>Applications</div>
          </div>
          <div className={styles.cardStat}>
            <div className={styles.cardStatValue}>
              {r.responseRate == null ? "—" : `${r.responseRate}%`}
            </div>
            <div className={styles.cardStatLabel}>Response Rate</div>
          </div>
          <div className={styles.cardStat}>
            <div className={styles.cardStatValue}>{formatBytes(r.fileSize)}</div>
            <div className={styles.cardStatLabel}>Size</div>
          </div>
        </div>

        <div className={styles.cardDate}>Uploaded {formatDate(r.uploadDate)}</div>
      </div>

      {/* Actions */}
      <div className={styles.cardActions}>
        <a
          className={styles.cardBtn}
          href={r.fileUrl || "#"}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!r.fileUrl ? "true" : "false"}
          onClick={(e) => {
            if (!r.fileUrl) e.preventDefault();
          }}
        >
          Download
        </a>
        <button className={styles.cardBtn} onClick={() => onRename(r)} type="button">
          Rename
        </button>
        <button className={`${styles.cardBtn} ${styles.cardBtnDanger}`} onClick={() => onDelete(r)} type="button">
          Delete
        </button>
      </div>
    </div>
  );
}
