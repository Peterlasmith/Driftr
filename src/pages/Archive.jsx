import React, { useEffect, useMemo, useState } from "react";
import shell from "../App.module.css";
import pageStyles from "./Archive.module.css";
import {
  deleteApplication,
  REJECTION_REASON_OPTIONS,
  subscribeToArchivedApplications,
  unarchiveApplication,
  updateRejectedApplicationFeedback
} from "../services/applications";
import { useAuth } from "../auth/AuthProvider";
import RejectedFeedbackEditor from "../components/RejectedFeedbackEditor";

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

function hasFeedback(row) {
  const note = String(row?.rejectionReasonNote || "").trim();
  const tags = Array.isArray(row?.rejectionReasonTags) ? row.rejectionReasonTags : [];
  return Boolean(note) || tags.length > 0;
}

function feedbackPreview(note) {
  const text = String(note || "").trim();
  if (!text) return "";
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export default function Archive() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [archived, setArchived] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [selectedTag, setSelectedTag] = useState("ALL");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [editingFeedbackId, setEditingFeedbackId] = useState(null);
  const [feedbackSavingId, setFeedbackSavingId] = useState(null);

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

  async function handleSaveFeedback(row, feedback) {
    if (!row?.id) return;
    setError("");
    setFeedbackSavingId(row.id);
    try {
      await updateRejectedApplicationFeedback(user.uid, row.id, feedback);
      setEditingFeedbackId((prev) => (prev === row.id ? null : prev));
    } catch (err) {
      setError(err?.message || "Failed to save feedback.");
      throw err;
    } finally {
      setFeedbackSavingId((prev) => (prev === row.id ? null : prev));
    }
  }

  return (
    <>
      <div className={shell.pgHeader}>
        <div className={shell.pgTitle}>Archive</div>
        <div className={shell.pgActions}>
          <div className={pageStyles.counter}>Archived: {archived.length}</div>
        </div>
      </div>

      <div className={shell.pgBody}>
        {error ? <div className={shell.errorBanner}>{error}</div> : null}

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
                  const isEditingFeedback = editingFeedbackId === row.id;
                  return (
                    <React.Fragment key={row.id}>
                      <tr>
                        <td>
                          <div className={pageStyles.cellStack}>
                            <div>{row.jobTitle || "-"}</div>
                            {String(row.rejectionReasonNote || "").trim() ? (
                              <div className={pageStyles.feedbackPreview}>
                                <span className={pageStyles.feedbackLabel}>Feedback:</span>{" "}
                                {feedbackPreview(row.rejectionReasonNote)}
                              </div>
                            ) : null}
                          </div>
                        </td>
                        <td>{row.company || "-"}</td>
                        <td>{formatDate(row.dateApplied)}</td>
                        <td>{formatDate(row.archivedAt)}</td>
                        <td>{tags.length ? tags.map((tag) => REASON_LABELS[tag] || tag).join(", ") : "-"}</td>
                        <td>{row.rejectionReasonNote || "-"}</td>
                        <td className={pageStyles.right}>
                          <div className={pageStyles.actions}>
                            <button
                              type="button"
                              className={pageStyles.secondaryButton}
                              onClick={() => setEditingFeedbackId(isEditingFeedback ? null : row.id)}
                            >
                              {isEditingFeedback
                                ? "Close feedback"
                                : hasFeedback(row)
                                  ? "Edit feedback"
                                  : "Add feedback"}
                            </button>
                            <button
                              type="button"
                              className={pageStyles.secondaryButton}
                              onClick={() => handleUnarchive(row.id)}
                            >
                              Unarchive
                            </button>
                            <button
                              type="button"
                              className={pageStyles.dangerButton}
                              onClick={() => handleDelete(row.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isEditingFeedback ? (
                        <tr className={pageStyles.feedbackEditorRow}>
                          <td colSpan={7}>
                            <RejectedFeedbackEditor
                              app={row}
                              reasonOptions={REJECTION_REASON_OPTIONS}
                              saving={feedbackSavingId === row.id}
                              onCancel={() => setEditingFeedbackId(null)}
                              onSave={(feedback) => handleSaveFeedback(row, feedback)}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
