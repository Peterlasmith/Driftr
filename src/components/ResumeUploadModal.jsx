import React, { useEffect, useMemo, useRef, useState } from "react";
import styles from "./ResumeUploadModal.module.css";
import { getNextResumeVersionName, uploadResumeFile, validateResumeFile } from "../services/resumes";
import { useAuth } from "../auth/AuthProvider";

export default function ResumeUploadModal({ open, onClose, resumes, onUploaded }) {
  const { user } = useAuth();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);

  const suggestedName = useMemo(() => getNextResumeVersionName(resumes || []), [resumes]);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setName(suggestedName);
    setError("");
    setUploading(false);
    requestAnimationFrame(() => inputRef.current?.focus?.());
  }, [open, suggestedName]);

  if (!open) return null;

  async function handleUpload() {
    if (!user?.uid) return;
    setError("");
    const validated = validateResumeFile(file);
    if (!validated.ok) {
      setError(validated.error);
      return;
    }
    if (!String(name || "").trim()) {
      setError("Add a name for this resume.");
      return;
    }

    setUploading(true);
    try {
      const resumeId = await uploadResumeFile(user.uid, { file, versionName: name });
      if (onUploaded) onUploaded(resumeId);
      onClose();
    } catch (err) {
      setError(err?.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Upload resume">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div className={styles.title}>Upload resume</div>
          <button className={styles.iconButton} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <label className={styles.field}>
            <div className={styles.label}>Resume name</div>
            <input
              ref={inputRef}
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={suggestedName}
            />
          </label>

          <label className={styles.field}>
            <div className={styles.label}>File</div>
            <input
              className={styles.input}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <div className={styles.hint}>PDF or DOCX, up to 5MB.</div>
          </label>

          {error ? <div className={styles.error}>{error}</div> : null}
        </div>

        <div className={styles.footer}>
          <button className={styles.secondaryButton} onClick={onClose} disabled={uploading}>
            Cancel
          </button>
          <button
            className={styles.primaryButton}
            onClick={handleUpload}
            disabled={uploading}
            aria-busy={uploading ? "true" : "false"}
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}

