import React, { useEffect, useMemo, useState } from "react";
import styles from "./ApplicationForm.module.css";
import { parseJobUrl } from "../services/jobUrlParser";

const EMPTY = {
  id: null,
  jobTitle: "",
  company: "",
  location: "",
  jobUrl: "",
  dateApplied: "",
  status: "Applied",
  resumeVersion: "",
  notes: ""
};

function toDateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function ApplicationForm({
  open,
  saving,
  initialValue,
  statusOptions,
  onClose,
  onSubmit
}) {
  const isEdit = Boolean(initialValue?.id);

  const initial = useMemo(() => {
    if (!initialValue) return { ...EMPTY, dateApplied: toDateInputValue(new Date()) };
    return {
      ...EMPTY,
      ...initialValue,
      dateApplied: toDateInputValue(initialValue.dateApplied)
    };
  }, [initialValue]);

  const [value, setValue] = useState(initial);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  useEffect(() => {
    setValue(initial);
    setParseError("");
  }, [initial]);

  if (!open) return null;

  function updateField(name, next) {
    setValue((v) => ({ ...v, [name]: next }));
  }

  function mergeAutofill(next) {
    setValue((v) => {
      return {
        ...v,
        jobTitle: v.jobTitle || next.jobTitle || "",
        company: v.company || next.company || "",
        location: v.location || next.location || ""
      };
    });
  }

  async function handleAutofill() {
    const url = value.jobUrl.trim();
    if (!url) return;
    setParseError("");
    setParsing(true);
    try {
      const result = await parseJobUrl(url);
      if (!result?.ok) {
        setParseError(result?.error || "Couldn’t auto-fill from that URL.");
        return;
      }
      mergeAutofill(result);
    } catch (err) {
      setParseError(err?.message || "Couldn’t auto-fill from that URL.");
    } finally {
      setParsing(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      ...(isEdit ? { id: value.id } : null),
      jobTitle: value.jobTitle.trim(),
      company: value.company.trim(),
      location: value.location.trim() || null,
      jobUrl: value.jobUrl.trim(),
      dateApplied: value.dateApplied || null,
      status: value.status,
      resumeVersion: value.resumeVersion.trim() || null,
      notes: value.notes.trim() || null
    };
    await onSubmit(payload);
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>{isEdit ? "Edit application" : "Add application"}</div>
          <button className={styles.iconButton} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.grid}>
            <label className={styles.field}>
              <div className={styles.label}>Job Title</div>
              <input
                className={styles.input}
                value={value.jobTitle}
                onChange={(e) => updateField("jobTitle", e.target.value)}
                placeholder="Frontend Engineer"
                required
              />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>Company</div>
              <input
                className={styles.input}
                value={value.company}
                onChange={(e) => updateField("company", e.target.value)}
                placeholder="Acme Inc."
                required
              />
            </label>

            <label className={styles.fieldWide}>
              <div className={styles.label}>Job URL</div>
              <div className={styles.urlRow}>
                <input
                  className={styles.input}
                  value={value.jobUrl}
                  onChange={(e) => updateField("jobUrl", e.target.value)}
                  onBlur={() => {
                    const shouldAuto =
                      value.jobUrl.trim() && !value.jobTitle.trim() && !value.company.trim();
                    if (shouldAuto && !parsing) handleAutofill();
                  }}
                  placeholder="https://…"
                />
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={handleAutofill}
                  disabled={parsing || !value.jobUrl.trim()}
                  aria-busy={parsing ? "true" : "false"}
                >
                  {parsing ? "Auto-filling…" : "Auto-fill"}
                </button>
              </div>
              {parseError ? <div className={styles.errorText}>{parseError}</div> : null}
            </label>

            <label className={styles.field}>
              <div className={styles.label}>
                Location <span className={styles.optional}>(optional)</span>
              </div>
              <input
                className={styles.input}
                value={value.location}
                onChange={(e) => updateField("location", e.target.value)}
                placeholder="San Francisco, CA"
              />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>Date Applied</div>
              <input
                className={styles.input}
                type="date"
                value={value.dateApplied}
                onChange={(e) => updateField("dateApplied", e.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <div className={styles.label}>Status</div>
              <select
                className={styles.input}
                value={value.status}
                onChange={(e) => updateField("status", e.target.value)}
              >
                {(statusOptions || []).map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.fieldWide}>
              <div className={styles.label}>
                Resume Version <span className={styles.optional}>(optional)</span>
              </div>
              <input
                className={styles.input}
                value={value.resumeVersion}
                onChange={(e) => updateField("resumeVersion", e.target.value)}
                placeholder="v3 / SWE-2026-02 / etc."
              />
            </label>

            <label className={styles.fieldWide}>
              <div className={styles.label}>
                Notes <span className={styles.optional}>(optional)</span>
              </div>
              <textarea
                className={styles.textarea}
                rows={4}
                value={value.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                placeholder="Recruiter name, next steps, takeaways…"
              />
            </label>
          </div>

          <div className={styles.footer}>
            <button type="button" className={styles.secondaryButton} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? "Saving…" : isEdit ? "Save changes" : "Add application"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
