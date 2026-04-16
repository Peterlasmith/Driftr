import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./Resumes.module.css";
import shell from "../App.module.css";
import { useAuth } from "../auth/AuthProvider";
import ResumeUploadModal from "../components/ResumeUploadModal";
import { analyzeResume, setResumeAnalysisFeedback } from "../services/resumeAnalysis";
import { deleteResumeAndUnlinkApplications, renameResume } from "../services/resumes";
import {
  formatResumeBytes,
  getResumeFileKind,
  useResumesWorkspace
} from "../components/resumesWorkspace/ResumesWorkspaceContext";

function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatAppliedDate(value) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function toList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(Boolean).map((item) => String(item));
}

function scoreClass(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return styles.scoreNeutral;
  if (n >= 80) return styles.scoreGood;
  if (n >= 60) return styles.scoreOk;
  return styles.scoreLow;
}

function getResumePreviewMode(resume) {
  const fileType = String(resume?.fileType || "").toLowerCase();
  const fileName = String(resume?.fileName || "").toLowerCase();
  if (!resume?.fileUrl) return "none";
  if (fileType.includes("pdf") || fileName.endsWith(".pdf")) return "pdf";
  if (
    fileType.includes("officedocument.wordprocessingml.document") ||
    fileName.endsWith(".docx")
  ) {
    return "docx";
  }
  return "none";
}

export default function Resumes() {
  const { user } = useAuth();
  const {
    resumes,
    rows,
    selectedResume,
    selectedVisibleApplications,
    selectedStats,
    setSelectedResumeId,
    legacyResumeLabels,
    loadingResumes,
    error: workspaceError
  } = useResumesWorkspace();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("insights");
  const [actionError, setActionError] = useState("");

  const [analysisBusyById, setAnalysisBusyById] = useState(() => new Map());
  const [analysisErrorById, setAnalysisErrorById] = useState(() => new Map());

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameSaving, setRenameSaving] = useState(false);
  const [renameError, setRenameError] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);

  const renameInputRef = useRef(null);
  const addMenuRef = useRef(null);

  const displayError = actionError || workspaceError;

  useEffect(() => {
    if (!addMenuOpen) return undefined;

    function handleOutsideClick(event) {
      if (!addMenuRef.current?.contains(event.target)) {
        setAddMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") setAddMenuOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [addMenuOpen]);

  const selectedAnalysis = selectedResume?.analysisResult || null;
  const selectedAnalysisBusy = selectedResume?.id
    ? Boolean(analysisBusyById.get(selectedResume.id))
    : false;
  const selectedAnalysisError = selectedResume?.id
    ? analysisErrorById.get(selectedResume.id) || ""
    : "";
  const previewMode = getResumePreviewMode(selectedResume);
  const canPreviewSelected = previewMode !== "none";

  const strengths = useMemo(() => toList(selectedAnalysis?.keyStrengths), [selectedAnalysis]);
  const signals = useMemo(() => toList(selectedAnalysis?.senioritySignals), [selectedAnalysis]);
  const gaps = useMemo(() => toList(selectedAnalysis?.gapsForNextLevel), [selectedAnalysis]);
  const alternatives = useMemo(() => {
    const source = Array.isArray(selectedAnalysis?.alternativeRoles)
      ? selectedAnalysis.alternativeRoles
      : [];

    return source
      .map((row) => ({
        title: String(row?.title || "").trim(),
        matchScore: Number(row?.matchScore)
      }))
      .filter((row) => row.title);
  }, [selectedAnalysis]);

  useEffect(() => {
    if (!renameOpen) return;
    requestAnimationFrame(() => renameInputRef.current?.focus?.());
  }, [renameOpen]);

  useEffect(() => {
    if (!previewOpen) return undefined;

    function handleEscape(event) {
      if (event.key === "Escape") setPreviewOpen(false);
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [previewOpen]);

  useEffect(() => {
    if (!previewOpen) return;
    if (!selectedResume?.fileUrl) {
      setPreviewOpen(false);
      return;
    }
    if (previewMode === "none") {
      setPreviewOpen(false);
    }
  }, [previewMode, previewOpen, selectedResume]);

  function openRenameModal(resume) {
    if (!resume) return;
    setRenameTarget(resume);
    setRenameValue(resume?.versionName || "");
    setRenameError("");
    setRenameSaving(false);
    setRenameOpen(true);
  }

  function closeRenameModal(force = false) {
    if (renameSaving && !force) return;
    setRenameOpen(false);
    setRenameTarget(null);
    setRenameValue("");
    setRenameError("");
  }

  async function handleRenameSubmit() {
    if (!renameTarget?.id || !user?.uid) return;
    setRenameError("");
    setActionError("");
    setRenameSaving(true);
    try {
      await renameResume(user.uid, renameTarget.id, renameValue);
      closeRenameModal(true);
    } catch (err) {
      setRenameError(err?.message || "Failed to rename resume.");
    } finally {
      setRenameSaving(false);
    }
  }

  async function handleDelete(resume) {
    if (!resume?.id || !user?.uid) return;
    const count = resume.appsCount ?? 0;
    const ok = window.confirm(
      `Delete "${resume.versionName || "this resume"}"?\n\nThis will unlink it from ${count} application(s). Those applications will keep a legacy text label.`
    );
    if (!ok) return;

    setActionError("");
    setAddMenuOpen(false);

    try {
      await deleteResumeAndUnlinkApplications(user.uid, resume);
    } catch (err) {
      setActionError(err?.message || "Failed to delete resume.");
    }
  }

  function handleDownload(resume) {
    if (!resume?.fileUrl) return;
    window.open(resume.fileUrl, "_blank", "noopener,noreferrer");
    setAddMenuOpen(false);
  }

  function handlePreview(resume) {
    if (!resume?.fileUrl) return;
    const mode = getResumePreviewMode(resume);
    if (mode === "none") return;
    setPreviewOpen(true);
    setAddMenuOpen(false);
  }

  async function handleAnalyze(resume) {
    if (!resume?.id) return;

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
      // ignore; the next snapshot will refresh state when available
    }
  }

  function openUpload() {
    setAddMenuOpen(false);
    setUploadOpen(true);
  }

  return (
    <>
      <div className={shell.pgHeader}>
        <div className={shell.pgTitle}>Resumes</div>
        <div className={shell.pgActions}>
          <div className={shell.addSplit} ref={addMenuRef}>
            <button
              className={`${shell.primaryButton} ${shell.addSplitMain}`}
              onClick={openUpload}
              type="button"
            >
              + Upload Resume
            </button>
            <button
              className={`${shell.primaryButton} ${shell.addSplitToggle}`}
              type="button"
              aria-label="Open resume actions menu"
              aria-haspopup="menu"
              aria-expanded={addMenuOpen}
              onClick={() => setAddMenuOpen((open) => !open)}
            >
              ▾
            </button>

            {addMenuOpen ? (
              <div className={`${shell.addMenu} ${styles.actionMenu}`} role="menu" aria-label="Resume actions">
                <button className={shell.addMenuItem} type="button" role="menuitem" onClick={openUpload}>
                  Upload Resume
                </button>
                <button
                  className={shell.addMenuItem}
                  type="button"
                  role="menuitem"
                  onClick={() => handlePreview(selectedResume)}
                  disabled={!canPreviewSelected}
                >
                  Preview Selected
                </button>
                <button
                  className={shell.addMenuItem}
                  type="button"
                  role="menuitem"
                  onClick={() => handleDownload(selectedResume)}
                  disabled={!selectedResume?.fileUrl}
                >
                  Download Selected
                </button>
                <button
                  className={shell.addMenuItem}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    openRenameModal(selectedResume);
                    setAddMenuOpen(false);
                  }}
                  disabled={!selectedResume}
                >
                  Rename Selected
                </button>
                <button
                  className={`${shell.addMenuItem} ${styles.menuDanger}`}
                  type="button"
                  role="menuitem"
                  onClick={() => handleDelete(selectedResume)}
                  disabled={!selectedResume}
                >
                  Delete Selected
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className={shell.pgBody}>
        {displayError ? <div className={shell.errorBanner}>{displayError}</div> : null}

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
            <div className={styles.loadingTitle}>Loading resumes...</div>
            <div className={styles.loadingSub}>Fetching from Firestore</div>
          </div>
        ) : rows.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyTitle}>No resumes yet</div>
            <div className={styles.emptySub}>Upload your first resume to get started.</div>
            <button className={styles.emptyButton} onClick={() => setUploadOpen(true)} type="button">
              + Upload Resume
            </button>
          </div>
        ) : (
          <section className={styles.detailPane}>
            {selectedResume ? (
              <>
                <div className={styles.detailHeader}>
                  <div className={styles.detailTitleRow}>
                    <div className={styles.detailTitle}>{selectedResume.versionName || "Untitled resume"}</div>
                    {selectedResume.isBest ? <span className={styles.bestPerformer}>Best performer</span> : null}
                  </div>
                  <div className={styles.detailFile}>{selectedResume.fileName || "—"}</div>
                </div>

                <div className={styles.metricsGrid}>
                  <MetricCard label="Applications" value={selectedResume.appsCount} />
                  <MetricCard
                    label="Interview Rate"
                    value={selectedResume.interviewRate == null ? "—" : `${selectedResume.interviewRate}%`}
                    valueClass={selectedResume.interviewRate == null ? "" : styles.resumePositive}
                  />
                  <MetricCard label="Interviews" value={selectedStats.interviews} />
                  <MetricCard
                    label="Avg Days"
                    value={selectedResume.appsCount > 0 ? selectedStats.avgDaysSince : "—"}
                  />
                </div>

                <ApplicationsSection applications={selectedVisibleApplications} />

                <div className={styles.tabs}>
                  <button
                    type="button"
                    className={`${styles.tab} ${activeTab === "insights" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("insights")}
                  >
                    AI Insights
                  </button>
                  <button
                    type="button"
                    className={`${styles.tab} ${activeTab === "details" ? styles.tabActive : ""}`}
                    onClick={() => setActiveTab("details")}
                  >
                    Details
                  </button>
                </div>

                {activeTab === "insights" ? (
                  <div className={styles.tabBody}>
                    {selectedAnalysisBusy ? (
                      <div className={styles.stateCard}>
                        <div className={styles.stateTitle}>Analyzing...</div>
                        <div className={styles.stateSub}>Extracting text and generating insights.</div>
                      </div>
                    ) : selectedAnalysisError ? (
                      <div className={`${styles.stateCard} ${styles.stateError}`}>
                        <div className={styles.stateTitle}>Could not analyze this resume</div>
                        <div className={styles.stateSub}>{selectedAnalysisError}</div>
                      </div>
                    ) : !selectedAnalysis ? (
                      <div className={styles.stateCard}>
                        <div className={styles.stateTitle}>No analysis yet</div>
                        <div className={styles.stateSub}>
                          Run AI analysis to generate role fit, strengths, and growth areas.
                        </div>
                        <button
                          className={styles.analyzeButton}
                          type="button"
                          onClick={() => handleAnalyze(selectedResume)}
                          disabled={selectedAnalysisBusy}
                          aria-busy={selectedAnalysisBusy ? "true" : "false"}
                        >
                          Analyze Resume
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className={styles.summaryBlock}>
                          <div className={styles.scoreRingWrap}>
                            <div className={styles.scoreRing}>
                              <span
                                className={`${styles.scoreValue} ${scoreClass(selectedAnalysis?.confidenceScore)}`}
                              >
                                {selectedAnalysis?.confidenceScore ?? "—"}
                              </span>
                            </div>
                          </div>

                          <div className={styles.summaryMain}>
                            <div className={styles.summaryRoleCard}>
                              <div className={styles.summaryLabel}>Primary role</div>
                              <div className={styles.summaryValue}>{selectedAnalysis?.primaryRole || "—"}</div>
                            </div>
                            <div className={styles.summaryMetaRow}>
                              <div className={styles.summaryMetaCard}>
                                <div className={styles.summaryLabel}>Seniority</div>
                                <div className={styles.summaryValue}>{selectedAnalysis?.seniorityLevel || "—"}</div>
                              </div>
                              <div className={styles.summaryMetaCard}>
                                <div className={styles.summaryLabel}>Experience</div>
                                <div className={styles.summaryValue}>
                                  {selectedAnalysis?.yearsOfExperience || "—"}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={styles.summaryText}>{selectedAnalysis?.summary || "—"}</div>

                        <div className={styles.insightsGrid}>
                          <InsightCard
                            title="Key strengths"
                            tone="good"
                            items={strengths}
                            emptyLabel="—"
                          />
                          <InsightCard
                            title="Level signals"
                            tone="warm"
                            items={signals}
                            emptyLabel="—"
                          />
                          <InsightCard
                            title="Growth gaps"
                            tone="risk"
                            items={gaps}
                            emptyLabel="—"
                          />
                        </div>

                        <div className={styles.altRolesSection}>
                          <div className={styles.altRolesTitle}>Alternative roles</div>
                          <div className={styles.altRolesGrid}>
                            {alternatives.length === 0 ? (
                              <div className={styles.altRoleCard}>
                                <div className={styles.altRoleScore}>—</div>
                                <div className={styles.altRoleName}>No alternatives yet</div>
                              </div>
                            ) : (
                              alternatives.map((role) => (
                                <div className={styles.altRoleCard} key={role.title}>
                                  <div className={styles.altRoleScore}>
                                    {Number.isFinite(role.matchScore) ? `${role.matchScore}%` : "—"}
                                  </div>
                                  <div className={styles.altRoleName}>{role.title}</div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className={styles.tabBody}>
                    <div className={styles.detailsGrid}>
                      <DetailRow label="File name" value={selectedResume.fileName || "—"} />
                      <DetailRow label="File type" value={getResumeFileKind(selectedResume)} />
                      <DetailRow label="File size" value={formatResumeBytes(selectedResume.fileSize)} />
                      <DetailRow label="Uploaded" value={formatDate(selectedResume.uploadDate)} />
                      <DetailRow label="Analyzed" value={formatDateTime(selectedResume.analyzedAt)} />
                    </div>

                    <div className={styles.feedbackCard}>
                      <div className={styles.feedbackLabel}>Was this helpful?</div>
                      <div className={styles.feedbackButtons}>
                        <button
                          className={`${styles.feedbackButton} ${
                            selectedResume.feedback === "thumbs_up" ? styles.feedbackActive : ""
                          }`}
                          onClick={() => handleFeedback(selectedResume.id, "thumbs_up")}
                          type="button"
                          disabled={selectedAnalysisBusy}
                          aria-pressed={selectedResume.feedback === "thumbs_up" ? "true" : "false"}
                        >
                          👍
                        </button>
                        <button
                          className={`${styles.feedbackButton} ${
                            selectedResume.feedback === "thumbs_down" ? styles.feedbackActive : ""
                          }`}
                          onClick={() => handleFeedback(selectedResume.id, "thumbs_down")}
                          type="button"
                          disabled={selectedAnalysisBusy}
                          aria-pressed={selectedResume.feedback === "thumbs_down" ? "true" : "false"}
                        >
                          👎
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className={styles.stateCard}>
                <div className={styles.stateTitle}>Select a resume</div>
                <div className={styles.stateSub}>Choose a resume from the list to view details.</div>
              </div>
            )}
          </section>
        )}
      </div>

      <ResumeUploadModal
        open={uploadOpen}
        resumes={resumes}
        onClose={() => setUploadOpen(false)}
        onUploaded={(resumeId) => {
          if (resumeId) {
            setSelectedResumeId(resumeId);
            setActiveTab("insights");
          }
        }}
      />

      {renameOpen ? (
        <div
          className={styles.renameBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-resume-title"
          onClick={() => closeRenameModal()}
        >
          <div
            className={styles.renameModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.renameHeader}>
              <div className={styles.renameTitle} id="rename-resume-title">
                Rename resume
              </div>
              <button
                className={styles.renameClose}
                type="button"
                onClick={() => closeRenameModal()}
                aria-label="Close rename dialog"
                disabled={renameSaving}
              >
                ✕
              </button>
            </div>

            <div className={styles.renameBody}>
              <label className={styles.renameField}>
                <div className={styles.renameLabel}>Resume name</div>
                <input
                  ref={renameInputRef}
                  className={styles.renameInput}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRenameSubmit();
                    if (e.key === "Escape") closeRenameModal();
                  }}
                  disabled={renameSaving}
                />
              </label>
              {renameError ? <div className={styles.renameError}>{renameError}</div> : null}
            </div>

            <div className={styles.renameFooter}>
              <button
                className={styles.renameBtnSecondary}
                type="button"
                onClick={() => closeRenameModal()}
                disabled={renameSaving}
              >
                Cancel
              </button>
              <button
                className={styles.renameBtnPrimary}
                type="button"
                onClick={handleRenameSubmit}
                disabled={renameSaving}
                aria-busy={renameSaving ? "true" : "false"}
              >
                {renameSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {previewOpen && selectedResume ? (
        <div
          className={styles.previewBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="resume-preview-title"
          onClick={() => setPreviewOpen(false)}
        >
          <div className={styles.previewModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewHeader}>
              <div className={styles.previewHeaderText}>
                <div className={styles.previewTitle} id="resume-preview-title">
                  Resume preview
                </div>
                <div className={styles.previewMeta}>
                  {selectedResume.versionName || "Untitled resume"}
                  <span className={styles.previewMetaDot}>•</span>
                  <span>{selectedResume.fileName || "—"}</span>
                </div>
              </div>

              <div className={styles.previewActions}>
                <button
                  className={styles.previewClose}
                  type="button"
                  onClick={() => setPreviewOpen(false)}
                  aria-label="Close preview"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className={styles.previewBody}>
              {previewMode === "pdf" ? (
                <iframe
                  title={`Resume preview: ${selectedResume.fileName || selectedResume.versionName || "resume"}`}
                  className={styles.previewFrame}
                  src={selectedResume.fileUrl}
                />
              ) : (
                <div className={styles.previewFallback}>
                  <div className={styles.previewFallbackTitle}>Preview isn’t available for DOCX yet.</div>
                  <div className={styles.previewFallbackText}>
                    DOCX files can’t be previewed inline in this version. PDF preview is supported
                    directly in the app.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function MetricCard({ label, value, valueClass = "" }) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={`${styles.metricValue} ${valueClass}`.trim()}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className={styles.detailCard}>
      <div className={styles.detailLabel}>{label}</div>
      <div className={styles.detailValue}>{value}</div>
    </div>
  );
}

function InsightCard({ title, items, emptyLabel, tone }) {
  return (
    <div className={`${styles.insightCard} ${tone ? styles[`tone_${tone}`] : ""}`.trim()}>
      <div className={styles.insightTitle}>{title}</div>
      {items.length === 0 ? (
        <div className={styles.insightEmpty}>{emptyLabel}</div>
      ) : (
        <ul className={styles.insightList}>
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ApplicationsSection({ applications }) {
  return (
    <section className={styles.applicationsSection} aria-label="Resume applications">
      <div className={styles.applicationsHeader}>
        <div className={styles.applicationsTitle}>Applications</div>
        <div className={styles.applicationsCount}>
          {applications.length} {applications.length === 1 ? "linked role" : "linked roles"}
        </div>
      </div>

      {applications.length === 0 ? (
        <div className={styles.applicationsEmpty}>
          No non-archived applications are linked to this resume yet.
        </div>
      ) : (
        <div className={styles.applicationList}>
          {applications.map((app) => (
            <article className={styles.applicationRow} key={app.id}>
              <div className={styles.applicationMain}>
                <div className={styles.applicationIdentity}>
                  <div className={styles.applicationJobTitle}>{app.jobTitle || "Untitled role"}</div>
                  <div className={styles.applicationCompany}>{app.company || "—"}</div>
                </div>
                <div className={styles.applicationMeta}>
                  <span>{formatAppliedDate(app.dateApplied)}</span>
                  <span className={styles.applicationMetaDot}>•</span>
                  <span>{app.stage || app.status || "Applied"}</span>
                </div>
              </div>
              {app.jobUrl ? (
                <a
                  className={styles.applicationLink}
                  href={app.jobUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  View posting
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
