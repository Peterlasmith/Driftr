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
  loading,
  onEdit,
  onDelete,
  onStatusChange
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
            <tr key={app.id}>
              <td className={styles.titleCell}>
                <div className={styles.jobTitle}>{app.jobTitle || "—"}</div>
                {app.jobUrl ? (
                  <a className={styles.url} href={app.jobUrl} target="_blank" rel="noreferrer">
                    View posting
                  </a>
                ) : null}
              </td>
              <td>{app.company || "—"}</td>
              <td>{formatDate(app.dateApplied)}</td>
              <td>
                <select
                  className={styles.select}
                  value={app.status || "Applied"}
                  onChange={(e) => onStatusChange(app.id, e.target.value)}
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
                  <button className={styles.secondaryButton} onClick={() => onEdit(app)}>
                    Edit
                  </button>
                  <button className={styles.dangerButton} onClick={() => onDelete(app.id)}>
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
