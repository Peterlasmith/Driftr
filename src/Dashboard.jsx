import React, { useEffect, useMemo, useRef, useState } from "react";
import ApplicationTable from "./components/ApplicationTable";
import ApplicationForm from "./components/ApplicationForm";
import {
  APPLICATION_STATUS_OPTIONS,
  archiveApplication,
  createApplication,
  deleteApplication,
  dismissStaleStatusPrompt,
  subscribeToApplications,
  updateApplication,
  updateApplicationStatusWithRejectionMeta
} from "./services/applications";
import { useAuth } from "./auth/AuthProvider";
import styles from "./App.module.css";
import { subscribeToResumes } from "./services/resumes";
import ApplicationCsvImportModal from "./components/ApplicationCsvImportModal";
import { DEFAULT_USER_PREFERENCES, subscribeToUserPreferences } from "./services/userPreferences";
import { getStaleStatusPromptState, normalizeApplicationStatus } from "./utils/staleStatus";

function buildRecruiterFeedbackEmail(app) {
  const role = app?.jobTitle || "the role";
  const company = app?.company || "your team";
  return [
    `Subject: Thank you — request for feedback on ${role}`,
    "",
    "Hi,",
    "",
    `Thank you for your time and for considering me for ${role}${company ? ` at ${company}` : ""}.`,
    "If you're able to share any brief feedback on my application/interview, I'd really appreciate it.",
    "I'm actively improving and any guidance would be helpful.",
    "",
    "Thanks again,",
    "[Your Name]"
  ].join("\n");
}

async function copyText(text) {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fallback below.
  }

  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "absolute";
    el.style.left = "-9999px";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export default function Dashboard() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [closedOutCollapsed, setClosedOutCollapsed] = useState(true);
  const [userPrefs, setUserPrefs] = useState(DEFAULT_USER_PREFERENCES);
  const addMenuRef = useRef(null);

  const nonArchivedApplications = useMemo(
    () => applications.filter((app) => !app.archivedAt),
    [applications]
  );
  const stalePromptEnabled = userPrefs?.rejectedFeedbackPromptEnabled !== false;
  const applicationsWithPromptState = useMemo(
    () =>
      nonArchivedApplications.map((app) => ({
        ...app,
        staleStatusPrompt: stalePromptEnabled ? getStaleStatusPromptState(app) : null
      })),
    [nonArchivedApplications, stalePromptEnabled]
  );
  const visibleApplications = useMemo(
    () =>
      applicationsWithPromptState.filter(
        (app) => normalizeApplicationStatus(app.status) !== "Not moving forward"
      ),
    [applicationsWithPromptState]
  );
  const closedOutApplications = useMemo(
    () =>
      applicationsWithPromptState.filter(
        (app) => normalizeApplicationStatus(app.status) === "Not moving forward"
      ),
    [applicationsWithPromptState]
  );

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    setError("");
    const unsubscribe = subscribeToApplications(
      user.uid,
      (rows) => {
        setApplications(rows);
        setLoading(false);
      },
      (err) => {
        setError(err?.message || "Failed to load applications.");
        setApplications([]);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!addMenuOpen) return undefined;

    function handleOutsideClick(event) {
      if (!addMenuRef.current?.contains(event.target)) {
        setAddMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") setAddMenuOpen(false);
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [addMenuOpen]);

  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = subscribeToResumes(
      user.uid,
      (rows) => setResumes(rows),
      () => setResumes([])
    );
    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) {
      setUserPrefs(DEFAULT_USER_PREFERENCES);
      return undefined;
    }

    const unsubscribe = subscribeToUserPreferences(
      user.uid,
      (prefs) => setUserPrefs(prefs),
      () => setUserPrefs(DEFAULT_USER_PREFERENCES)
    );

    return () => unsubscribe();
  }, [user?.uid]);

  async function handleCreateOrUpdate(payload) {
    setSaving(true);
    setError("");

    try {
      const isEdit = Boolean(payload?.id);
      if (isEdit) {
        await updateApplication(user.uid, payload.id, payload);
      } else {
        await createApplication(user.uid, payload);
      }
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      setError(err?.message || "Failed to save application.");
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    const ok = window.confirm("Delete this application?");
    if (!ok) return;
    setError("");
    try {
      await deleteApplication(user.uid, id);
    } catch (err) {
      setError(err?.message || "Failed to delete application.");
    }
  }

  async function handleStatusChange(app, status) {
    if (!APPLICATION_STATUS_OPTIONS.includes(status)) return;
    if (!app?.id) return;

    setError("");
    try {
      await updateApplicationStatusWithRejectionMeta(user.uid, app.id, status);
    } catch (err) {
      setError(err?.message || "Failed to update status.");
    }
  }

  async function handleArchive(id) {
    setError("");
    try {
      await archiveApplication(user.uid, id);
    } catch (err) {
      setError(err?.message || "Failed to archive application.");
    }
  }

  async function handleRequestRecruiterFeedback(app) {
    const email = buildRecruiterFeedbackEmail(app);
    return copyText(email);
  }

  async function handleMoveToNotMovingForward(app) {
    if (!app?.id) return;
    setError("");
    try {
      await updateApplicationStatusWithRejectionMeta(user.uid, app.id, "Not moving forward");
    } catch (err) {
      setError(err?.message || "Failed to update status.");
    }
  }

  async function handleDismissStalePrompt(app) {
    if (!app?.id) return;
    setError("");
    try {
      await dismissStaleStatusPrompt(user.uid, app.id, app.status);
    } catch (err) {
      setError(err?.message || "Failed to save reminder preference.");
    }
  }

  function openAdd() {
    setAddMenuOpen(false);
    setEditing(null);
    setFormOpen(true);
  }

  function openImport() {
    setAddMenuOpen(false);
    setFormOpen(false);
    setEditing(null);
    setImportOpen(true);
  }

  function openEdit(app) {
    setEditing(app);
    setFormOpen(true);
  }

  return (
    <>
      <div className={styles.pgHeader}>
        <div className={styles.pgTitle}>Applications</div>
        <div className={styles.pgActions}>
          <div className={styles.addSplit} ref={addMenuRef}>
            <button className={`${styles.primaryButton} ${styles.addSplitMain}`} onClick={openAdd} type="button">
              + Add application
            </button>
            <button
              className={`${styles.primaryButton} ${styles.addSplitToggle}`}
              type="button"
              aria-label="Open add application menu"
              aria-haspopup="menu"
              aria-expanded={addMenuOpen}
              onClick={() => setAddMenuOpen((value) => !value)}
            >
              ▾
            </button>

            {addMenuOpen ? (
              <div className={styles.addMenu} role="menu" aria-label="Add application options">
                <button className={styles.addMenuItem} onClick={openImport} type="button" role="menuitem">
                  Import CSV
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.pgBody}>
        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        <ApplicationTable
          applications={visibleApplications}
          closedOutApplications={closedOutApplications}
          closedOutCollapsed={closedOutCollapsed}
          onToggleClosedOutCollapse={() => setClosedOutCollapsed((value) => !value)}
          loading={loading}
          onEdit={openEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onArchive={handleArchive}
          onMoveToNotMovingForward={handleMoveToNotMovingForward}
          onDismissStalePrompt={handleDismissStalePrompt}
          onRequestRecruiterFeedback={handleRequestRecruiterFeedback}
          statusOptions={APPLICATION_STATUS_OPTIONS}
        />
      </div>

      <ApplicationForm
        open={formOpen}
        saving={saving}
        statusOptions={APPLICATION_STATUS_OPTIONS}
        initialValue={editing}
        resumes={resumes}
        applications={applications}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleCreateOrUpdate}
      />

      <ApplicationCsvImportModal
        open={importOpen}
        userId={user?.uid}
        resumes={resumes}
        onClose={() => setImportOpen(false)}
      />
    </>
  );
}
