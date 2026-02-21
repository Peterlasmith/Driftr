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

export default function RejectionReasonModal({
  open,
  app,
  reasonOptions,
  saving,
  onCancel,
  onSubmit
}) {
  const [selected, setSelected] = useState([]);
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);

  const canSubmit = selected.length > 0;
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    if (!open) return;
    const initialTags = Array.isArray(app?.rejectionReasonTags) ? app.rejectionReasonTags : [];
    setSelected(initialTags);
    setNote(app?.rejectionReasonNote || "");
    setTouched(false);
  }, [open, app]);

  if (!open) return null;

  function toggleTag(tag) {
    setTouched(true);
    setSelected((prev) => {
      if (prev.includes(tag)) return prev.filter((value) => value !== tag);
      return [...prev, tag];
    });
  }

  async function handleSubmit() {
    setTouched(true);
    if (!canSubmit) return;
    await onSubmit({ tags: selected, note, archiveNow: false });
    setSelected([]);
    setNote("");
    setTouched(false);
  }

  function handleCancel() {
    if (saving) return;
    setSelected([]);
    setNote("");
    setTouched(false);
    onCancel();
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
          <div className={styles.label}>Why was this rejected?</div>
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
          {touched && !canSubmit ? <div className={styles.error}>Select at least one reason tag.</div> : null}

          <label className={styles.noteField}>
            <div className={styles.label}>Note (optional)</div>
            <textarea
              className={styles.textarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context for future review or model improvements"
            />
          </label>
        </div>

        <div className={styles.footer}>
          <button className={styles.secondaryButton} onClick={handleCancel} disabled={saving}>
            Cancel
          </button>
          <button
            className={styles.primaryButton}
            onClick={handleSubmit}
            disabled={saving || !canSubmit}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
