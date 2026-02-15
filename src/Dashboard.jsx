import React, { useEffect, useMemo, useState } from "react";
import StatsCards from "./components/StatsCards";
import ApplicationTable from "./components/ApplicationTable";
import ApplicationForm from "./components/ApplicationForm";
import {
  createApplication,
  deleteApplication,
  subscribeToApplications,
  updateApplication,
  updateApplicationStatus
} from "./services/applications";
import { useAuth } from "./auth/AuthProvider";
import styles from "./App.module.css";
import AppHeader from "./components/AppHeader";
import { subscribeToResumes } from "./services/resumes";

const STATUS_OPTIONS = ["Applied", "Screening", "Interview", "Offer", "Rejected"];

function daysSince(dateApplied) {
  if (!dateApplied) return null;
  const start = new Date(dateApplied);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function calcStats(applications) {
  const total = applications.length;
  const active = applications.filter(
    (a) => a.status !== "Rejected" && a.status !== "Offer"
  ).length;
  const responded = applications.filter((a) => a.status !== "Applied").length;
  const responseRate = total === 0 ? 0 : Math.round((responded / total) * 100);

  const dayValues = applications
    .map((a) => daysSince(a.dateApplied))
    .filter((n) => typeof n === "number");
  const avgDaysSince =
    dayValues.length === 0
      ? 0
      : Math.round(dayValues.reduce((sum, n) => sum + n, 0) / dayValues.length);

  return { total, active, responseRate, avgDaysSince };
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [applications, setApplications] = useState([]);
  const [resumes, setResumes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const stats = useMemo(() => calcStats(applications), [applications]);

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

  async function handleStatusChange(id, status) {
    if (!STATUS_OPTIONS.includes(status)) return;
    setError("");
    try {
      await updateApplicationStatus(user.uid, id, status);
    } catch (err) {
      setError(err?.message || "Failed to update status.");
    }
  }

  function openAdd() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(app) {
    setEditing(app);
    setFormOpen(true);
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
      <AppHeader
        userEmail={user?.email}
        onLogout={handleLogout}
        primaryAction={
          <button className={styles.primaryButton} onClick={openAdd}>
            + Add application
          </button>
        }
      />

      <main className={styles.main}>
        <StatsCards
          total={stats.total}
          responseRate={stats.responseRate}
          active={stats.active}
          avgDaysSince={stats.avgDaysSince}
        />

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Applications</div>
            <div className={styles.panelMeta}>Sorted by newest date applied</div>
          </div>

          {error ? <div className={styles.errorBanner}>{error}</div> : null}

          <ApplicationTable
            applications={applications}
            loading={loading}
            onEdit={openEdit}
            onDelete={handleDelete}
            onStatusChange={handleStatusChange}
          />
        </section>
      </main>

      <ApplicationForm
        open={formOpen}
        saving={saving}
        statusOptions={STATUS_OPTIONS}
        initialValue={editing}
        resumes={resumes}
        applications={applications}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleCreateOrUpdate}
      />
    </div>
  );
}
