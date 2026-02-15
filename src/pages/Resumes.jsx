import React, { useEffect, useMemo, useState } from "react";
import styles from "./Resumes.module.css";
import shell from "../App.module.css";
import { useAuth } from "../auth/AuthProvider";
import AppHeader from "../components/AppHeader";
import ResumeUploadModal from "../components/ResumeUploadModal";
import { subscribeToApplications } from "../services/applications";
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

  return (
    <div className={shell.page}>
      <AppHeader
        userEmail={user?.email}
        onLogout={handleLogout}
        primaryAction={
          <button className={shell.primaryButton} onClick={() => setUploadOpen(true)}>
            + Upload Resume
          </button>
        }
      />

      <main className={shell.main}>
        <section className={shell.panel}>
          <div className={shell.panelHeader}>
            <div className={shell.panelTitle}>Resumes</div>
            <div className={shell.panelMeta}>Performance updates as you log application outcomes</div>
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
    </div>
  );
}
