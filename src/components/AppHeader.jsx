import React from "react";
import { NavLink } from "react-router-dom";
import styles from "../App.module.css";
import logo from "../assets/logo.svg";

export default function AppHeader({ userEmail, onLogout, primaryAction }) {
  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <NavLink to="/" className={styles.logoLink} aria-label="Driftr dashboard">
          <img className={styles.logoImage} src={logo} alt="Driftr" />
        </NavLink>
        <div className={styles.subtitle}>Signed in as {userEmail || "Unknown"}</div>
      </div>

      <div className={styles.headerRight}>
        <nav className={styles.nav} aria-label="Primary">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              [styles.navLink, isActive ? styles.navLinkActive : ""].filter(Boolean).join(" ")
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/resumes"
            className={({ isActive }) =>
              [styles.navLink, isActive ? styles.navLinkActive : ""].filter(Boolean).join(" ")
            }
          >
            Resumes
          </NavLink>
        </nav>

        {primaryAction}
        <button className={styles.primaryButton} onClick={onLogout}>
          Log out
        </button>
      </div>
    </header>
  );
}

