import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import styles from "./Auth.module.css";

function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code === "auth/email-already-in-use") return "That email is already in use.";
  if (code === "auth/weak-password") return "Password is too weak (try 6+ characters).";
  if (code === "auth/invalid-email") return "Please enter a valid email.";
  if (code === "auth/popup-closed-by-user") return "Google sign-in was canceled.";
  if (code === "auth/network-request-failed") return "Network error. Please try again.";
  return err?.message || "Signup failed. Please try again.";
}

export default function Signup() {
  const { signUpWithEmail, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = useMemo(() => {
    return location?.state?.from?.pathname || "/";
  }, [location]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    navigate(redirectTo, { replace: true });
  }, [user, redirectTo, navigate]);

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await signUpWithEmail(email.trim(), password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    }
    setSubmitting(false);
  }

  async function onGoogle() {
    setSubmitting(true);
    setError("");
    try {
      await signInWithGoogle();
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(friendlyAuthError(err));
    }
    setSubmitting(false);
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.header}>
          <div className={styles.title}>Sign up</div>
          <div className={styles.subtitle}>Create an account for Driftr</div>
        </div>

        <div className={styles.content}>
          {error ? <div className={styles.errorBanner}>{error}</div> : null}

          <form onSubmit={onSubmit} className={styles.content}>
            <div className={styles.row}>
              <div className={styles.label}>Email</div>
              <input
                className={styles.input}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className={styles.row}>
              <div className={styles.label}>Password</div>
              <input
                className={styles.input}
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className={styles.primaryButton} type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create account"}
            </button>
          </form>

          <div className={styles.divider}>OR</div>

          <button className={styles.secondaryButton} onClick={onGoogle} disabled={submitting}>
            Continue with Google
          </button>
        </div>

        <div className={styles.footer}>
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
