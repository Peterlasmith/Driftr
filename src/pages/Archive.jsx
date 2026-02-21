import React, { useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader";
import styles from "../App.module.css";
import pageStyles from "./Archive.module.css";
import {
  deleteApplication,
  REJECTION_REASON_OPTIONS,
  subscribeToArchivedApplications,
  unarchiveApplication
} from "../services/applications";
import { useAuth } from "../auth/AuthProvider";

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

function formatDate(dateValue) {
  if (!dateValue) return "-";
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

export default function Archive() {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [archived, setArchived] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedTag, setSelectedTag] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    setError("");
    const unsubscribe = subscribeToArchivedApplications(
      user.uid,
      (rows) => {
        setArchived(rows);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Failed to load archive.");
        setArchived([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const from = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : null;
    const to = toDate ? new Date(`${toDate}T23:59:59`).getTime() : null;

    return archived.filter((row) => {
      if (query) {
        const job = String(row.jobTitle || "").toLowerCase();
        const company = String(row.company || "").toLowerCase();
        if (!job.includes(query) && !company.includes(query)) return false;
      }

      if (selectedTag !== "ALL") {
        const tags = Array.isArray(row.rejectionReasonTags) ? row.rejectionReasonTags : [];
        if (!tags.includes(selectedTag)) return false;
      }

      if (from || to) {
        const archivedMs = row.archivedAt ? new Date(row.archivedAt).getTime() : null;
        if (!archivedMs) return false;
        if (from && archivedMs < from) return false;
        if (to && archivedMs > to) return false;
      }

      return true;
    });
  }, [archived, searchText, selectedTag, fromDate, toDate]);

  async function handleUnarchive(id) {
    setError("");
    try {
      await unarchiveApplication(user.uid, id);
    } catch (err) {
      setError(err?.message || "Failed to unarchive application.");
    }
  }

  async function handleDelete(id) {
    const ok = window.confirm("Permanently delete this archived application?");
    if (!ok) return;

    setError("");
    try {
      await deleteApplication(user.uid, id);
    } catch (err) {
      setError(err?.message || "Failed to delete application.");
    }
  }

  async function handleLogout() {
    setError("");
    try {
      await logout();
    } catch (err) {
      setError(err?.message || "Failed to log out.");
    }
  }

  return (
    <div className={styles.page}>
      <AppHeader userEmail={user?.email} onLogout={handleLogout} />

      <main className={styles.main}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderMain}>
              <div className={styles.panelTitle}>Archive</div>
              <div className={styles.panelMeta}>Rejected applications only</div>
            </div>
            <div className={styles.panelHeaderActions}>
              <div className={pageStyles.counter}>Archived rejected: {archived.length}</div>
            </div>
          </div>

          {error ? <div className={styles.errorBanner}>{error}</div> : null}

          <div className={pageStyles.filters}>
            <input
              className={pageStyles.input}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search title or company"
            />
            <select
              className={pageStyles.input}
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
            >
              <option value="ALL">All reasons</option>
              {REJECTION_REASON_OPTIONS.map((tag) => (
                <option key={tag} value={tag}>
                  {REASON_LABELS[tag] || tag}
                </option>
              ))}
            </select>
            <input
              className={pageStyles.input}
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              max={toDate || undefined}
            />
            <input
              className={pageStyles.input}
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              min={fromDate || undefined}
            />
          </div>

          {loading ? (
            <div className={pageStyles.empty}>Loading archive...</div>
          ) : filteredRows.length === 0 ? (
            <div className={pageStyles.empty}>No archived applications match the current filters.</div>
          ) : (
            <div className={pageStyles.tableWrap}>
              <table className={pageStyles.table}>
                <thead>
                  <tr>
                    <th>Role</th>
                    <th>Company</th>
                    <th>Date Applied</th>
                    <th>Archived</th>
                    <th>Reasons</th>
                    <th>Notes</th>
                    <th className={pageStyles.right}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row) => {
                    const tags = Array.isArray(row.rejectionReasonTags) ? row.rejectionReasonTags : [];
                    return (
                      <tr key={row.id}>
                        <td>{row.jobTitle || "-"}</td>
                        <td>{row.company || "-"}</td>
                        <td>{formatDate(row.dateApplied)}</td>
                        <td>{formatDate(row.archivedAt)}</td>
                        <td>{tags.length ? tags.map((tag) => REASON_LABELS[tag] || tag).join(", ") : "-"}</td>
                        <td>{row.rejectionReasonNote || "-"}</td>
                        <td className={pageStyles.right}>
                          <div className={pageStyles.actions}>
                            <button className={pageStyles.secondaryButton} onClick={() => handleUnarchive(row.id)}>
                              Unarchive
                            </button>
                            <button className={pageStyles.dangerButton} onClick={() => handleDelete(row.id)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
