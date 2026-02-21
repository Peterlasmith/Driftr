import React, { useState } from "react";
import { Link } from "react-router-dom";
import AppHeader from "../components/AppHeader";
import { useAuth } from "../auth/AuthProvider";
import shell from "../App.module.css";
import styles from "./Settings.module.css";

export default function Settings() {
  const { user, logout } = useAuth();
  const [error, setError] = useState("");

  async function handleLogout() {
    setError("");
    try {
      await logout();
    } catch (err) {
      setError(err?.message || "Failed to log out.");
    }
  }

  return (
    <div className={shell.page}>
      <AppHeader userEmail={user?.email} onLogout={handleLogout} />

      <main className={shell.main}>
        <section className={shell.panel}>
          <div className={shell.panelHeader}>
            <div className={shell.panelTitle}>Settings</div>
            <div className={shell.panelMeta}>Low-frequency account and data options</div>
          </div>

          {error ? <div className={shell.errorBanner}>{error}</div> : null}

          <div className={styles.grid}>
            <article className={styles.card}>
              <div className={styles.cardTitle}>Profile</div>
              <div className={styles.cardText}>Signed in as {user?.email || "Unknown user"}</div>
              <div className={styles.cardHint}>More account preferences can be added here later.</div>
            </article>

            <article className={styles.card}>
              <div className={styles.cardTitle}>Data Management</div>
              <div className={styles.cardText}>
                Archived rejected applications are hidden from primary navigation.
              </div>
              <Link className={styles.archiveLink} to="/archive">
                View archived applications
              </Link>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
