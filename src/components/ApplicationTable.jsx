import React from "react";
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
  onCaptureRejection
}) {
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
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            onArchive={onArchive}
            onCaptureRejection={onCaptureRejection}
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
        <tbody>
          {applications.map((app) => (
            <ApplicationRow
              key={app.id}
              app={app}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
              onArchive={onArchive}
              onCaptureRejection={onCaptureRejection}
            />
          ))}
        </tbody>
      </table>

      <RejectedSection
        rows={rejectedApplications}
        collapsed={rejectedCollapsed}
        onToggle={onToggleRejectedCollapse}
        onEdit={onEdit}
        onDelete={onDelete}
        onStatusChange={onStatusChange}
        onArchive={onArchive}
        onCaptureRejection={onCaptureRejection}
      />
    </div>
  );
}

function ApplicationRow({ app, onEdit, onDelete, onStatusChange, onArchive, onCaptureRejection }) {
  return (
    <tr>
      <td>
        <div className={styles.titleCell}>
          <div className={styles.jobTitle}>{app.jobTitle || "—"}</div>
          {app.jobUrl ? (
            <a className={styles.url} href={app.jobUrl} target="_blank" rel="noreferrer">
              View posting
            </a>
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
          {app.status === "Rejected" && onArchive ? (
            <button className={styles.secondaryButton} onClick={() => onArchive(app.id)}>
              Archive
            </button>
          ) : null}
          {app.status === "Rejected" && onCaptureRejection ? (
            <button className={styles.secondaryButton} onClick={() => onCaptureRejection(app)}>
              Reason
            </button>
          ) : null}
          <button className={styles.secondaryButton} onClick={() => onEdit(app)}>
            Edit
          </button>
          <button className={styles.dangerButton} onClick={() => onDelete(app.id)}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function RejectedSection({
  rows,
  collapsed,
  onToggle,
  onEdit,
  onDelete,
  onStatusChange,
  onArchive,
  onCaptureRejection
}) {
  if (!rows || rows.length === 0) return null;
  return (
    <div className={styles.rejectedSection}>
      <button className={styles.rejectedHeader} onClick={onToggle}>
        Rejected ({rows.length}) {collapsed ? "▸" : "▾"}
      </button>
      {!collapsed ? (
        <table className={styles.table}>
          <tbody>
            {rows.map((app) => (
              <ApplicationRow
                key={app.id}
                app={app}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onArchive={onArchive}
                onCaptureRejection={onCaptureRejection}
              />
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
