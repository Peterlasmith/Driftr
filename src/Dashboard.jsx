import React, { useEffect, useMemo, useState } from "react";
import ApplicationTable from "./components/ApplicationTable";
import ApplicationForm from "./components/ApplicationForm";
import {
  APPLICATION_STATUS_OPTIONS,
  REJECTION_REASON_OPTIONS,
  archiveApplication,
  createApplication,
  deleteApplication,
  subscribeToApplications,
  updateApplication,
  updateApplicationStatusWithRejectionMeta
} from "./services/applications";
import { useAuth } from "./auth/AuthProvider";
import styles from "./App.module.css";
import { subscribeToResumes } from "./services/resumes";
import ApplicationCsvImportModal from "./components/ApplicationCsvImportModal";
import RejectionReasonModal from "./components/RejectionReasonModal";
import { calcStats } from "./utils/statsCalc";

export default function Dashboard() {
  const { user } = useAuth();
  const [applications, setApplications] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [rejectedCollapsed, setRejectedCollapsed] = useState(true);
  const [rejectionModal, setRejectionModal] = useState({ open: false, app: null });
  const [rejectionSaving, setRejectionSaving] = useState(false);

  const nonArchivedApplications = useMemo(
    () => applications.filter((app) => !app.archivedAt),
    [applications]
  );
  const visibleApplications = useMemo(
    () => nonArchivedApplications.filter((app) => app.status !== "Rejected"),
    [nonArchivedApplications]
  );
  const rejectedApplications = useMemo(
    () => nonArchivedApplications.filter((app) => app.status === "Rejected"),
    [nonArchivedApplications]
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
    if (!user?.uid) return;
    const unsubscribe = subscribeToResumes(
      user.uid,
      (rows) => setResumes(rows),
      () => setResumes([])
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

    if (status === "Rejected" && app.status !== "Rejected") {
      setRejectionModal({ open: true, app });
      return;
    }

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

  function handleRejectionCancel() {
    if (rejectionSaving) return;
    setRejectionModal({ open: false, app: null });
  }

  async function handleRejectionSubmit(payload) {
    if (!rejectionModal.app?.id) return;
    setRejectionSaving(true);
    setError("");
    try {
      await updateApplicationStatusWithRejectionMeta(user.uid, rejectionModal.app.id, "Rejected", payload);
      setRejectionModal({ open: false, app: null });
    } catch (err) {
      setError(err?.message || "Failed to save rejection details.");
    } finally {
      setRejectionSaving(false);
    }
  }

  function openRejectionReasonModal(app) {
    if (!app?.id) return;
    setRejectionModal({ open: true, app });
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
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
          <button className={styles.primaryButton} onClick={openAdd} type="button">
            + Add application
          </button>
        </div>
      </div>

      <div className={styles.pgBody}>
        {error ? <div className={styles.errorBanner}>{error}</div> : null}

        <ApplicationTable
          applications={visibleApplications}
          rejectedApplications={rejectedApplications}
          rejectedCollapsed={rejectedCollapsed}
          onToggleRejectedCollapse={() => setRejectedCollapsed((value) => !value)}
          loading={loading}
          onEdit={openEdit}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          onArchive={handleArchive}
          onCaptureRejection={openRejectionReasonModal}
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
        onOpenImport={() => {
          setFormOpen(false);
          setEditing(null);
          setImportOpen(true);
        }}
        onSubmit={handleCreateOrUpdate}
      />

      <RejectionReasonModal
        open={rejectionModal.open}
        app={rejectionModal.app}
        reasonOptions={REJECTION_REASON_OPTIONS}
        saving={rejectionSaving}
        onCancel={handleRejectionCancel}
        onSubmit={handleRejectionSubmit}
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
