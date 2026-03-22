import React from "react";
import styles from "./ApplicationTable.module.css";
import { normalizeApplicationStatus } from "../utils/staleStatus";

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

function feedbackPreview(note) {
  const text = String(note || "").trim();
  if (!text) return "";
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export default function ApplicationTable({
  applications,
  closedOutApplications = [],
  closedOutCollapsed = true,
  onToggleClosedOutCollapse,
  loading,
  onEdit,
  onDelete,
  onStatusChange,
  onArchive,
  onMoveToNotMovingForward,
  onDismissStalePrompt,
  onRequestRecruiterFeedback,
  statusOptions = []
}) {
  function renderRow(app) {
    return (
      <ApplicationRow
        key={app.id}
        app={app}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onArchive={onArchive}
        onMoveToNotMovingForward={onMoveToNotMovingForward}
        onDismissStalePrompt={onDismissStalePrompt}
        onRequestRecruiterFeedback={onRequestRecruiterFeedback}
        statusOptions={statusOptions}
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
    const hasClosedOut = closedOutApplications.length > 0;
    if (hasClosedOut) {
      return (
        <div className={styles.tableWrap}>
          <ClosedOutSection
            rows={closedOutApplications}
            collapsed={closedOutCollapsed}
            onToggle={onToggleClosedOutCollapse}
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

      <ClosedOutSection
        rows={closedOutApplications}
        collapsed={closedOutCollapsed}
        onToggle={onToggleClosedOutCollapse}
        renderRow={renderRow}
      />
    </div>
  );
}

function ApplicationRow({
  app,
  onEdit,
  onDelete,
  onStatusChange,
  onArchive,
  onMoveToNotMovingForward,
  onDismissStalePrompt,
  onRequestRecruiterFeedback,
  statusOptions
}) {
  const status = normalizeApplicationStatus(app.status);
  const closedOut = status === "Not moving forward";
  const showPreview = String(app?.rejectionReasonNote || "").trim();
  const showStalePrompt = app?.staleStatusPrompt?.shouldPrompt;
  const rowStatusOptions = statusOptions.includes(status)
    ? statusOptions
    : [status, ...statusOptions].filter(Boolean);

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
            {showStalePrompt ? (
              <div className={styles.stalePrompt}>
                <div className={styles.stalePromptText}>
                  It&apos;s been over 30 days with no status update. We recommend moving this to Not moving
                  forward if you&apos;re no longer expecting movement.
                </div>
                <div className={styles.stalePromptActions}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => onMoveToNotMovingForward?.(app)}
                  >
                    Move to Not moving forward
                  </button>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => onDismissStalePrompt?.(app)}
                  >
                    Keep as is
                  </button>
                  {onRequestRecruiterFeedback ? (
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => onRequestRecruiterFeedback(app)}
                    >
                      Copy follow-up email
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </td>
        <td>{app.company || "—"}</td>
        <td>{formatDate(app.dateApplied)}</td>
        <td>
          <select
            className={styles.select}
            value={status || "Applied"}
            onChange={(e) => onStatusChange(app, e.target.value)}
          >
            {rowStatusOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </td>
        <td className={styles.right}>{daysSince(app.dateApplied)}</td>
        <td className={styles.right}>
          <div className={styles.actions}>
            {closedOut && onArchive ? (
              <button type="button" className={styles.secondaryButton} onClick={() => onArchive(app.id)}>
                Archive
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
    </>
  );
}

function ClosedOutSection({ rows, collapsed, onToggle, renderRow }) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className={styles.closedOutSection}>
      <button type="button" className={styles.closedOutHeader} onClick={onToggle}>
        Not moving forward ({rows.length}) {collapsed ? "▸" : "▾"}
      </button>
      {!collapsed ? (
        <table className={styles.table}>
          <tbody>{rows.map(renderRow)}</tbody>
        </table>
      ) : null}
    </div>
  );
}
