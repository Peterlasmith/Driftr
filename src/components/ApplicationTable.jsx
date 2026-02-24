import React, { useState } from "react";
import RejectedFeedbackEditor from "./RejectedFeedbackEditor";
import styles from "./ApplicationTable.module.css";

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function daysSince(dateApplied) {
  if (!dateApplied) return "—";
  const start = new Date(dateApplied);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function hasFeedback(app) {
  const note = String(app?.rejectionReasonNote || "").trim();
  const tags = Array.isArray(app?.rejectionReasonTags) ? app.rejectionReasonTags : [];
  return Boolean(note) || tags.length > 0;
}

function feedbackPreview(note) {
  const text = String(note || "").trim();
  if (!text) return "";
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export default function ApplicationTable({
  applications,
  rejectedApplications = [],
  rejectedCollapsed = true,
  onToggleRejectedCollapse,
  loading,
  onEdit,
  onDelete,
  onStatusChange,
  onArchive,
  reasonOptions = [],
  onSaveRejectedFeedback
}) {
  const [editingFeedbackId, setEditingFeedbackId] = useState(null);
  const [savingFeedbackId, setSavingFeedbackId] = useState(null);

  async function handleSaveFeedback(app, feedback) {
    if (!onSaveRejectedFeedback || !app?.id) return;
    setSavingFeedbackId(app.id);
    try {
      await onSaveRejectedFeedback(app, feedback);
      setEditingFeedbackId((prev) => (prev === app.id ? null : prev));
    } finally {
      setSavingFeedbackId((prev) => (prev === app.id ? null : prev));
    }
  }

  function renderRow(app) {
    return (
      <ApplicationRowWithFeedback
        key={app.id}
        app={app}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onArchive={onArchive}
        reasonOptions={reasonOptions}
        onSaveRejectedFeedback={onSaveRejectedFeedback ? handleSaveFeedback : null}
        feedbackEditing={editingFeedbackId === app.id}
        feedbackSaving={savingFeedbackId === app.id}
        onOpenFeedbackEditor={() => setEditingFeedbackId(app.id)}
        onCloseFeedbackEditor={() =>
          setEditingFeedbackId((prev) => (prev === app.id ? null : prev))
        }
      />
    );
  }

  if (loading) {
    return (
      <div className={styles.loadingWrap}>
        <div className={styles.loadingTitle}>Loading applications…</div>
        <div className={styles.loadingSub}>Fetching from Firestore</div>
      </div>
    );
  }

  if (!applications || applications.length === 0) {
    const hasRejected = rejectedApplications.length > 0;
    if (hasRejected) {
      return (
        <div className={styles.tableWrap}>
          <RejectedSection
            rows={rejectedApplications}
            collapsed={rejectedCollapsed}
            onToggle={onToggleRejectedCollapse}
            renderRow={renderRow}
          />
        </div>
      );
    }
    return (
      <div className={styles.emptyWrap}>
        <div className={styles.emptyTitle}>No applications yet</div>
        <div className={styles.emptySub}>Click “Add application” to create your first entry.</div>
      </div>
    );
  }

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Job Title</th>
            <th>Company</th>
            <th>Date Applied</th>
            <th>Status</th>
            <th className={styles.right}>Days Since</th>
            <th className={styles.right}>Actions</th>
          </tr>
        </thead>
        <tbody>{applications.map(renderRow)}</tbody>
      </table>

      <RejectedSection
        rows={rejectedApplications}
        collapsed={rejectedCollapsed}
        onToggle={onToggleRejectedCollapse}
        renderRow={renderRow}
      />
    </div>
  );
}

function ApplicationRowWithFeedback({
  app,
  onEdit,
  onDelete,
  onStatusChange,
  onArchive,
  reasonOptions,
  onSaveRejectedFeedback,
  feedbackEditing,
  feedbackSaving,
  onOpenFeedbackEditor,
  onCloseFeedbackEditor
}) {
  const rejected = app.status === "Rejected";
  const showPreview = rejected && String(app?.rejectionReasonNote || "").trim();
  const showEditor = rejected && feedbackEditing && onSaveRejectedFeedback;

  return (
    <>
      <tr>
        <td>
          <div className={styles.titleCell}>
            <div className={styles.jobTitle}>{app.jobTitle || "—"}</div>
            {app.jobUrl ? (
              <a className={styles.url} href={app.jobUrl} target="_blank" rel="noreferrer">
                View posting
              </a>
            ) : null}
            {showPreview ? (
              <div className={styles.feedbackPreview}>
                <span className={styles.feedbackLabel}>Feedback:</span> {feedbackPreview(app.rejectionReasonNote)}
              </div>
            ) : null}
          </div>
        </td>
        <td>{app.company || "—"}</td>
        <td>{formatDate(app.dateApplied)}</td>
        <td>
          <select
            className={styles.select}
            value={app.status || "Applied"}
            onChange={(e) => onStatusChange(app, e.target.value)}
          >
            <option value="Applied">Applied</option>
            <option value="Screening">Screening</option>
            <option value="Interview">Interview</option>
            <option value="Offer">Offer</option>
            <option value="Rejected">Rejected</option>
          </select>
        </td>
        <td className={styles.right}>{daysSince(app.dateApplied)}</td>
        <td className={styles.right}>
          <div className={styles.actions}>
            {rejected && onArchive ? (
              <button type="button" className={styles.secondaryButton} onClick={() => onArchive(app.id)}>
                Archive
              </button>
            ) : null}
            {rejected && onSaveRejectedFeedback ? (
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={feedbackEditing ? onCloseFeedbackEditor : onOpenFeedbackEditor}
              >
                {feedbackEditing ? "Close feedback" : hasFeedback(app) ? "Edit feedback" : "Add feedback"}
              </button>
            ) : null}
            <button type="button" className={styles.secondaryButton} onClick={() => onEdit(app)}>
              Edit
            </button>
            <button type="button" className={styles.dangerButton} onClick={() => onDelete(app.id)}>
              Delete
            </button>
          </div>
        </td>
      </tr>

      {showEditor ? (
        <tr className={styles.feedbackEditorRow}>
          <td colSpan={6}>
            <RejectedFeedbackEditor
              app={app}
              reasonOptions={reasonOptions}
              saving={feedbackSaving}
              onCancel={onCloseFeedbackEditor}
              onSave={(feedback) => onSaveRejectedFeedback(app, feedback)}
            />
          </td>
        </tr>
      ) : null}
    </>
  );
}

function RejectedSection({ rows, collapsed, onToggle, renderRow }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className={styles.rejectedSection}>
      <button type="button" className={styles.rejectedHeader} onClick={onToggle}>
        Rejected ({rows.length}) {collapsed ? "▸" : "▾"}
      </button>
      {!collapsed ? (
        <table className={styles.table}>
          <tbody>{rows.map(renderRow)}</tbody>
        </table>
      ) : null}
    </div>
  );
}
