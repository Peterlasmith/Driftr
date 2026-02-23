import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { getInitials } from "../utils/statsCalc";
import styles from "./IconRail.module.css";
import logoSrc from "../assets/logo.svg";

export default function IconRail({ userEmail }) {
  const { pathname } = useLocation();
  const dashboardActive = pathname === "/" || pathname === "/dashboard";
  const resumesActive = pathname === "/resumes" || pathname.startsWith("/resumes/");
  const settingsActive =
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/archive" ||
    pathname.startsWith("/archive/");

  const initials = getInitials(userEmail);

  return (
    <nav className={styles.rail} aria-label="Primary">
      <NavLink to="/" className={styles.logo} aria-label="Driftr home">
        <img src={logoSrc} alt="" className={styles.logoImg} />
      </NavLink>

      <NavLink
        to="/"
        end
        className={[styles.railBtn, dashboardActive ? styles.on : ""].filter(Boolean).join(" ")}
        aria-label="Dashboard"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
          <rect x="1" y="1" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="10" y="1" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="1" y="10" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
          <rect x="10" y="10" width="7" height="7" rx="2" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className={styles.tip}>Dashboard</span>
      </NavLink>

      <NavLink
        to="/resumes"
        className={[styles.railBtn, resumesActive ? styles.on : ""].filter(Boolean).join(" ")}
        aria-label="Resumes"
      >
        <svg width="16" height="18" viewBox="0 0 16 18" fill="none" aria-hidden="true">
          <path
            d="M10 1H3C2.44772 1 2 1.44772 2 2V16C2 16.5523 2.44772 17 3 17H13C13.5523 17 14 16.5523 14 16V5L10 1Z"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path d="M10 1V5H14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="5" y1="9" x2="11" y2="9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <line x1="5" y1="12" x2="9" y2="12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
        <span className={styles.tip}>Resumes</span>
      </NavLink>

      <div className={styles.spacer} />

      <NavLink
        to="/settings"
        className={[styles.railBtn, settingsActive ? styles.on : ""].filter(Boolean).join(" ")}
        aria-label="Settings"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        <span className={styles.tip}>Settings</span>
      </NavLink>

      <div className={styles.avatar} aria-label={`Account: ${userEmail || "Unknown"}`}>
        {initials}
      </div>
    </nav>
  );
}
