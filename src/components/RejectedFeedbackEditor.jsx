import React, { useEffect, useMemo, useState } from "react";
import styles from "./RejectedFeedbackEditor.module.css";

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

export default function RejectedFeedbackEditor({
  app,
  reasonOptions = [],
  saving = false,
  onSave,
  onCancel
}) {
  const [selected, setSelected] = useState([]);
  const [note, setNote] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    setSelected(Array.isArray(app?.rejectionReasonTags) ? app.rejectionReasonTags : []);
    setNote(app?.rejectionReasonNote || "");
  }, [app?.id, app?.rejectionReasonNote, app?.rejectionReasonTags]);

  function toggleTag(tag) {
    setSelected((prev) => (prev.includes(tag) ? prev.filter((value) => value !== tag) : [...prev, tag]));
  }

  async function handleSave() {
    if (!onSave) return;
    await onSave({ tags: selected, note });
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.label}>Quick reasons (optional)</div>
      <div className={styles.tagGrid}>
        {reasonOptions.map((tag) => {
          const isSelected = selectedSet.has(tag);
          return (
            <button
              key={tag}
              type="button"
              className={[styles.tag, isSelected ? styles.tagSelected : ""].filter(Boolean).join(" ")}
              onClick={() => toggleTag(tag)}
              disabled={saving}
            >
              {toLabel(tag)}
            </button>
          );
        })}
      </div>

      <label className={styles.field}>
        <div className={styles.label}>Feedback (optional)</div>
        <textarea
          className={styles.textarea}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add recruiter/interviewer feedback, your observations, or anything useful for later."
          disabled={saving}
        />
      </label>

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="button" className={styles.primaryButton} onClick={handleSave} disabled={saving}>
          Save feedback
        </button>
      </div>
    </div>
  );
}
