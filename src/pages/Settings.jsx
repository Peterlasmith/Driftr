import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import shell from "../App.module.css";
import styles from "./Settings.module.css";
import { DEFAULT_USER_PREFERENCES, subscribeToUserPreferences, upsertUserPreferences } from "../services/userPreferences";

export default function Settings() {
  const { user } = useAuth();
  const [error, setError] = useState("");
  const [userPrefs, setUserPrefs] = useState(DEFAULT_USER_PREFERENCES);
  const [profileDraft, setProfileDraft] = useState({
    fullName: DEFAULT_USER_PREFERENCES.fullName,
    targetRole: DEFAULT_USER_PREFERENCES.targetRole
  });
  const [savingPromptPref, setSavingPromptPref] = useState(false);
  const [savingProfile, setSavingProfile] = useState({
    fullName: false,
    targetRole: false
  });

  useEffect(() => {
    if (!user?.uid) {
      setUserPrefs(DEFAULT_USER_PREFERENCES);
      setProfileDraft({
        fullName: DEFAULT_USER_PREFERENCES.fullName,
        targetRole: DEFAULT_USER_PREFERENCES.targetRole
      });
      return undefined;
    }
    const unsubscribe = subscribeToUserPreferences(
      user.uid,
      (prefs) => {
        setUserPrefs(prefs);
        setProfileDraft({
          fullName: prefs?.fullName || "",
          targetRole: prefs?.targetRole || ""
        });
      },
      () => {
        setUserPrefs(DEFAULT_USER_PREFERENCES);
        setProfileDraft({
          fullName: DEFAULT_USER_PREFERENCES.fullName,
          targetRole: DEFAULT_USER_PREFERENCES.targetRole
        });
      }
    );
    return () => unsubscribe();
  }, [user?.uid]);

  function handleProfileChange(field, value) {
    setProfileDraft((prev) => ({ ...prev, [field]: value }));
  }

  async function handleProfileBlur(field) {
    if (!user?.uid || savingProfile[field]) return;

    const rawValue = profileDraft?.[field] ?? "";
    const trimmedValue = String(rawValue).trim();
    const currentSavedValue = String(userPrefs?.[field] ?? "").trim();

    if (trimmedValue === currentSavedValue) {
      if (rawValue !== trimmedValue) {
        setProfileDraft((prev) => ({ ...prev, [field]: trimmedValue }));
      }
      return;
    }

    const previousSavedValue = String(userPrefs?.[field] ?? "");
    setSavingProfile((prev) => ({ ...prev, [field]: true }));
    setError("");
    setProfileDraft((prev) => ({ ...prev, [field]: trimmedValue }));
    setUserPrefs((prev) => ({ ...prev, [field]: trimmedValue }));

    try {
      await upsertUserPreferences(user.uid, { [field]: trimmedValue });
    } catch (err) {
      setProfileDraft((prev) => ({ ...prev, [field]: previousSavedValue }));
      setUserPrefs((prev) => ({ ...prev, [field]: previousSavedValue }));
      setError(err?.message || "Failed to save settings.");
    } finally {
      setSavingProfile((prev) => ({ ...prev, [field]: false }));
    }
  }

  async function handleToggleRejectedPrompt() {
    if (!user?.uid || savingPromptPref) return;
    const next = !(userPrefs?.rejectedFeedbackPromptEnabled !== false);
    setSavingPromptPref(true);
    setError("");
    setUserPrefs((prev) => ({ ...prev, rejectedFeedbackPromptEnabled: next }));
    try {
      await upsertUserPreferences(user.uid, { rejectedFeedbackPromptEnabled: next });
    } catch (err) {
      setUserPrefs((prev) => ({ ...prev, rejectedFeedbackPromptEnabled: !next }));
      setError(err?.message || "Failed to save settings.");
    } finally {
      setSavingPromptPref(false);
    }
  }

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
                <input
                  className={styles.input}
                  type="text"
                  placeholder="Your name"
                  value={profileDraft.fullName}
                  onChange={(event) => handleProfileChange("fullName", event.target.value)}
                  onBlur={() => handleProfileBlur("fullName")}
                  disabled={savingProfile.fullName}
                />
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
                <input
                  className={styles.input}
                  type="text"
                  placeholder="e.g. Frontend Engineer"
                  value={profileDraft.targetRole}
                  onChange={(event) => handleProfileChange("targetRole", event.target.value)}
                  onBlur={() => handleProfileBlur("targetRole")}
                  disabled={savingProfile.targetRole}
                />
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

          <section className={styles.section}>
            <div className={styles.sectionTitle}>Applications</div>
            <div className={styles.card}>
              <div className={styles.toggleRow}>
                <div>
                  <div className={styles.toggleLabel}>Stale Application Prompt</div>
                  <div className={styles.toggleSub}>
                    Prompt when an application has gone 30+ days without a status update
                  </div>
                </div>
                <button
                  className={`${styles.toggle} ${
                    userPrefs?.rejectedFeedbackPromptEnabled !== false ? styles.toggleOn : ""
                  }`}
                  onClick={handleToggleRejectedPrompt}
                  type="button"
                  role="switch"
                  aria-checked={userPrefs?.rejectedFeedbackPromptEnabled !== false}
                  aria-label="Toggle stale application prompt"
                  disabled={savingPromptPref}
                >
                  <span className={styles.toggleKnob} />
                </button>
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
                  <div className={styles.accountSub}>View not moving forward applications moved to archive</div>
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
