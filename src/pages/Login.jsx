import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import styles from "./Auth.module.css";
import logo from "../assets/logo.svg";

function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code === "auth/invalid-credential") return "Invalid email or password.";
  if (code === "auth/user-not-found") return "Invalid email or password.";
  if (code === "auth/wrong-password") return "Invalid email or password.";
  if (code === "auth/popup-closed-by-user") return "Google sign-in was canceled.";
  if (code === "auth/network-request-failed") return "Network error. Please try again.";
  return err?.message || "Login failed. Please try again.";
}

export default function Login() {
  const { signInWithEmail, signInWithGoogle, user } = useAuth();
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
      await signInWithEmail(email.trim(), password);
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
          <div className={styles.brand}>
            <img className={styles.brandLogo} src={logo} alt="Driftr" />
          </div>
          <div className={styles.title}>Log in</div>
          <div className={styles.subtitle}>Access your Driftr dashboard</div>
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button className={styles.primaryButton} type="submit" disabled={submitting}>
              {submitting ? "Logging in..." : "Log in"}
            </button>
          </form>

          <div className={styles.divider}>OR</div>

          <button className={styles.secondaryButton} onClick={onGoogle} disabled={submitting}>
            Continue with Google
          </button>
        </div>

        <div className={styles.footer}>
          No account? <Link to="/signup">Create one</Link>
        </div>
      </div>
    </div>
  );
}
