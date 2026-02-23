import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import shell from "../App.module.css";
import styles from "./Settings.module.css";

export default function Settings() {
  const { user } = useAuth();
  const [error, setError] = useState("");

  return (
    <>
      <div className={shell.pgHeader}>
        <div className={shell.pgTitle}>Settings</div>
      </div>

      <div className={shell.pgBody}>
        {error ? <div className={shell.errorBanner}>{error}</div> : null}

        <div className={styles.body}>
          {/* Profile section */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Profile</div>
            <div className={styles.card}>
              <div className={styles.row}>
                <label className={styles.label}>Full Name</label>
                <input className={styles.input} type="text" placeholder="Your name" />
              </div>
              <div className={styles.row}>
                <label className={styles.label}>Email</label>
                <input
                  className={styles.input}
                  type="email"
                  value={user?.email || ""}
                  readOnly
                  disabled
                />
              </div>
              <div className={styles.row}>
                <label className={styles.label}>Target Role</label>
                <input className={styles.input} type="text" placeholder="e.g. Frontend Engineer" />
              </div>
            </div>
          </section>

          {/* Notifications section — Coming Soon */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Notifications</div>
            <div className={styles.comingSoonWrap}>
              <div className={styles.card} style={{ filter: "blur(3px)", pointerEvents: "none", userSelect: "none" }}>
                <ToggleRow label="Weekly Digest" sub="Summary of applications and response rates" />
                <ToggleRow label="Stale Alerts" sub="Remind you about applications with no updates" />
                <ToggleRow label="AI Insights" sub="Get notified when new resume analysis is ready" />
              </div>
              <div className={styles.comingSoonOverlay}>
                <span className={styles.comingSoonBadge}>Coming Soon</span>
              </div>
            </div>
          </section>

          {/* Account section */}
          <section className={styles.section}>
            <div className={styles.sectionTitle}>Account</div>
            <div className={styles.card}>
              <div className={styles.accountRow}>
                <div>
                  <div className={styles.accountLabel}>Archived Applications</div>
                  <div className={styles.accountSub}>View rejected applications moved to archive</div>
                </div>
                <Link className={styles.btn} to="/archive">
                  View Archive
                </Link>
              </div>
              <div className={styles.accountRow}>
                <div>
                  <div className={styles.accountLabel}>Export Data</div>
                  <div className={styles.accountSub}>Download all your applications as CSV</div>
                </div>
                <button className={styles.btn} type="button">Export CSV</button>
              </div>
              <div className={styles.accountRow}>
                <div>
                  <div className={styles.accountLabel}>Delete Account</div>
                  <div className={styles.accountSub}>Permanently remove your account and data</div>
                </div>
                <button className={`${styles.btn} ${styles.btnDanger}`} type="button">Delete</button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

function ToggleRow({ label, sub }) {
  const [on, setOn] = useState(false);
  return (
    <div className={styles.toggleRow}>
      <div>
        <div className={styles.toggleLabel}>{label}</div>
        <div className={styles.toggleSub}>{sub}</div>
      </div>
      <button
        className={`${styles.toggle} ${on ? styles.toggleOn : ""}`}
        onClick={() => setOn(!on)}
        type="button"
        role="switch"
        aria-checked={on}
      >
        <span className={styles.toggleKnob} />
      </button>
    </div>
  );
}
