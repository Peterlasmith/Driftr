import React, { useEffect, useMemo, useState } from "react";
import styles from "./Resumes.module.css";
import shell from "../App.module.css";
import { useAuth } from "../auth/AuthProvider";
import AppHeader from "../components/AppHeader";
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
  const { user, logout } = useAuth();
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

  async function handleLogout() {
    setError("");
    try {
      await logout();
    } catch (err) {
      setError(err?.message || "Failed to log out.");
    }
  }

  async function handleDelete(resume) {
    const count = perf.byId.get(resume.id)?.applications ?? 0;
    const ok = window.confirm(
      `Delete “${resume.versionName || "this resume"}”?\n\nThis will unlink it from ${count} application(s). Those applications will keep a legacy text label.`
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
    <div className={shell.page}>
      <AppHeader userEmail={user?.email} onLogout={handleLogout} />

      <main className={shell.main}>
        <section className={shell.panel}>
          <div className={shell.panelHeader}>
            <div className={shell.panelHeaderMain}>
              <div className={shell.panelTitle}>Resumes</div>
              <div className={shell.panelMeta}>Performance updates as you log application outcomes</div>
            </div>
            <div className={shell.panelHeaderActions}>
              <button
                className={shell.primaryButton}
                onClick={() => setUploadOpen(true)}
                type="button"
              >
                + Upload Resume
              </button>
            </div>
          </div>

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
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Resume</th>
                    <th>Uploaded</th>
                    <th className={styles.right}>Applications</th>
                    <th className={styles.right}>Response Rate</th>
                    <th className={styles.right}>File</th>
                    <th className={styles.right}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={r.isBest ? styles.bestRow : ""}>
                      <td>
                        <div className={styles.resumeCell}>
                          <div className={styles.resumeName}>
                            {r.versionName || "Untitled resume"}
                            {r.isBest ? <span className={styles.bestBadge}>Best</span> : null}
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
                                onClick={() => handleOpenAnalysis(r)}
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
                          <div className={styles.resumeMeta}>{r.fileName || "—"}</div>
                        </div>
                      </td>
                      <td>{formatDate(r.uploadDate)}</td>
                      <td className={styles.right}>{r.appsCount}</td>
                      <td className={styles.right}>
                        {r.responseRate == null ? (
                          <span className={styles.muted}>Not enough data</span>
                        ) : (
                          <span className={styles.rate}>{r.responseRate}%</span>
                        )}
                      </td>
                      <td className={styles.right}>
                        <span className={styles.muted}>
                          {r.fileType ? r.fileType.split("/").pop()?.toUpperCase() : "—"} ·{" "}
                          {formatBytes(r.fileSize)}
                        </span>
                      </td>
                      <td className={styles.right}>
                        <div className={styles.actions}>
                          <a
                            className={styles.secondaryButton}
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
                          <button
                            className={styles.secondaryButton}
                            onClick={() => handleRename(r)}
                            type="button"
                          >
                            Rename
                          </button>
                          <button
                            className={styles.dangerButton}
                            onClick={() => handleDelete(r)}
                            type="button"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>

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
    </div>
  );
}
