import React from "react";
import styles from "./ResumesSidebar.module.css";
import {
  formatResumeBytes,
  getResumeFileKind,
  useResumesWorkspace
} from "./resumesWorkspace/ResumesWorkspaceContext";

export default function ResumesSidebar() {
  const {
    rows,
    selectedResume,
    setSelectedResumeId,
    loadingResumes
  } = useResumesWorkspace();

  return (
    <aside className={styles.panel}>
      <div className={styles.head}>
        <div className={styles.title}>Resumes</div>
        <div className={styles.sub}>{rows.length} files uploaded</div>
      </div>

      {loadingResumes ? (
        <div className={styles.state}>
          <div className={styles.stateTitle}>Loading resumes...</div>
          <div className={styles.stateSub}>Fetching from Firestore</div>
        </div>
      ) : rows.length === 0 ? (
        <div className={styles.state}>
          <div className={styles.stateTitle}>No resumes yet</div>
          <div className={styles.stateSub}>Upload a resume to start tracking performance.</div>
        </div>
      ) : (
        <div className={styles.rows}>
          {rows.map((resume) => {
            const active = selectedResume?.id === resume.id;
            return (
              <button
                key={resume.id}
                type="button"
                className={`${styles.row} ${active ? styles.rowActive : ""}`}
                onClick={() => setSelectedResumeId(resume.id)}
              >
                <div className={styles.rowTop}>
                  <div className={styles.rowIdentity}>
                    <span className={styles.fileIcon}>{getResumeFileKind(resume)}</span>
                    <span className={styles.name}>{resume.versionName || "Untitled resume"}</span>
                  </div>
                  {resume.isBest ? <span className={styles.bestPill}>Best</span> : null}
                </div>

                <div className={styles.rowMeta}>
                  <span>{resume.appsCount} apps</span>
                  <span className={styles.metaDot}>•</span>
                  <span className={resume.responseRate == null ? styles.muted : styles.positive}>
                    {resume.responseRate == null ? "—" : `${resume.responseRate}%`}
                  </span>
                  <span className={styles.metaDot}>•</span>
                  <span>{formatResumeBytes(resume.fileSize)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}
