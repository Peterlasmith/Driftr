import React, { useEffect, useMemo, useState } from "react";
import styles from "./RejectionReasonModal.module.css";

const REASON_LABELS = {
  NO_RESPONSE: "No response",
  SCREEN_REJECT: "Rejected at screen",
  INTERVIEW_REJECT: "Rejected after interview",
  ROLE_CLOSED: "Role closed",
  SALARY_MISMATCH: "Salary mismatch",
  SKILL_MISMATCH: "Skill mismatch",
  CULTURE_FIT: "Culture fit",
  OTHER: "Other",
  UNKNOWN: "Unknown"
};

function toLabel(tag) {
  return REASON_LABELS[tag] || tag;
}

function buildRecruiterFeedbackDraft(app) {
  const role = app?.jobTitle || "the role";
  const company = app?.company || "your team";
  return [
    `Subject: Thank you — request for feedback on ${role}`,
    "",
    "Hi,",
    "",
    `Thank you for your time and for considering me for ${role}${company ? ` at ${company}` : ""}.`,
    "If you're able to share any brief feedback on my application/interview, I'd really appreciate it.",
    "I'm actively improving and any guidance would be helpful.",
    "",
    "Thanks again,",
    "[Your Name]"
  ].join("\n");
}

export default function RejectionReasonModal({
  open,
  app,
  reasonOptions,
  saving,
  onCancel,
  onSubmit,
  onRequestRecruiterFeedback
}) {
  const [selected, setSelected] = useState([]);
  const [note, setNote] = useState("");
  const [copyState, setCopyState] = useState("");
  const [showRecruiterDraft, setShowRecruiterDraft] = useState(false);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    if (!open) return;
    const initialTags = Array.isArray(app?.rejectionReasonTags) ? app.rejectionReasonTags : [];
    setSelected(initialTags);
    setNote(app?.rejectionReasonNote || "");
    setCopyState("");
    setShowRecruiterDraft(false);
  }, [open, app]);

  if (!open) return null;

  function toggleTag(tag) {
    setSelected((prev) => {
      if (prev.includes(tag)) return prev.filter((value) => value !== tag);
      return [...prev, tag];
    });
  }

  async function handleSubmit() {
    await onSubmit?.({ tags: selected, note, archiveNow: false });
    setSelected([]);
    setNote("");
    setCopyState("");
    setShowRecruiterDraft(false);
  }

  function handleCancel() {
    if (saving) return;
    setSelected([]);
    setNote("");
    setCopyState("");
    onCancel();
  }

  async function handleCopyRecruiterFeedback() {
    if (!onRequestRecruiterFeedback) return;
    try {
      const copied = await onRequestRecruiterFeedback(app);
      setCopyState(copied ? "Copied email text." : "Could not copy email text.");
    } catch {
      setCopyState("Could not copy email text.");
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="rejection-title">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div id="rejection-title" className={styles.title}>
            Mark as rejected
          </div>
          <button className={styles.iconButton} onClick={handleCancel} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <div className={styles.context}>
            {app?.jobTitle || "Role"} at {app?.company || "Company"}
          </div>
          <div className={styles.label}>Quick reasons (optional)</div>
          <div className={styles.tagGrid}>
            {(reasonOptions || []).map((tag) => {
              const isSelected = selectedSet.has(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  className={[styles.tag, isSelected ? styles.tagSelected : ""].filter(Boolean).join(" ")}
                  onClick={() => toggleTag(tag)}
                >
                  {toLabel(tag)}
                </button>
              );
            })}
          </div>

          <label className={styles.noteField}>
            <div className={styles.label}>Feedback (optional)</div>
            <textarea
              className={styles.textarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add recruiter/interviewer feedback or your own notes for later review"
            />
          </label>

          <div className={styles.recruiterSection}>
            <div className={styles.recruiterHeader}>
              <div>
                <div className={styles.label}>Recruiter feedback request (optional)</div>
                <div className={styles.helperMessage}>
                  Preview a short email you can copy and send yourself.
                </div>
              </div>
              <button
                type="button"
                className={styles.inlineLink}
                onClick={() => {
                  setShowRecruiterDraft((prev) => !prev);
                  setCopyState("");
                }}
                disabled={saving}
              >
                {showRecruiterDraft ? "Hide email draft" : "Preview email draft"}
              </button>
            </div>

            {showRecruiterDraft ? (
              <div className={styles.recruiterDraftWrap}>
                <pre className={styles.recruiterDraft}>{buildRecruiterFeedbackDraft(app)}</pre>
                <div className={styles.recruiterActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={handleCopyRecruiterFeedback}
                    disabled={saving}
                  >
                    Copy email text
                  </button>
                </div>
                {copyState ? <div className={styles.helperMessage}>{copyState}</div> : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.secondaryButton} onClick={handleCancel} disabled={saving}>
            Cancel
          </button>
          <button className={styles.primaryButton} onClick={handleSubmit} disabled={saving}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
