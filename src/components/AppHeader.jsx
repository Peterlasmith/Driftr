import React, { useEffect, useId, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import styles from "../App.module.css";
import logo from "../assets/logo.svg";

export default function AppHeader({ userEmail, onLogout }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const settingsRef = useRef(null);
  const dashboardActive = pathname === "/" || pathname === "/dashboard";
  const resumesActive = pathname === "/resumes" || pathname.startsWith("/resumes/");
  const settingsActive =
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/archive" ||
    pathname.startsWith("/archive/");

  useEffect(() => {
    if (!menuOpen) return;

    function closeOnOutsidePointer(event) {
      const target = event.target;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setMenuOpen(false);
    }

    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      setMenuOpen(false);
      triggerRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    requestAnimationFrame(() => settingsRef.current?.focus());
  }, [menuOpen]);

  function handleMenuBlur() {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (menuRef.current?.contains(active) || triggerRef.current?.contains(active)) return;
      setMenuOpen(false);
    }, 0);
  }

  function toggleMenu() {
    setMenuOpen((open) => !open);
  }

  function handleTriggerKeyDown(event) {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    setMenuOpen(true);
  }

  function handleSettingsClick() {
    setMenuOpen(false);
  }

  function handleLogoutClick() {
    setMenuOpen(false);
    onLogout();
  }

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
            className={[styles.navLink, dashboardActive ? styles.navLinkActive : ""]
              .filter(Boolean)
              .join(" ")}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/resumes"
            className={[styles.navLink, resumesActive ? styles.navLinkActive : ""]
              .filter(Boolean)
              .join(" ")}
          >
            Resumes
          </NavLink>
        </nav>

        <div className={styles.accountMenu} onBlurCapture={handleMenuBlur}>
          <button
            ref={triggerRef}
            className={styles.secondaryButton}
            aria-haspopup="menu"
            aria-expanded={menuOpen ? "true" : "false"}
            aria-controls={menuId}
            onClick={toggleMenu}
            onKeyDown={handleTriggerKeyDown}
            type="button"
          >
            Account
          </button>
          <div
            id={menuId}
            ref={menuRef}
            className={[styles.accountMenuPanel, menuOpen ? styles.accountMenuPanelOpen : ""]
              .filter(Boolean)
              .join(" ")}
            role="menu"
            aria-label="Account"
          >
            <NavLink
              ref={settingsRef}
              to="/settings"
              className={[styles.accountMenuItem, settingsActive ? styles.accountMenuItemActive : ""]
                .filter(Boolean)
                .join(" ")}
              role="menuitem"
              onClick={handleSettingsClick}
            >
              Settings
            </NavLink>
            <button
              className={styles.accountMenuItem}
              role="menuitem"
              onClick={handleLogoutClick}
              type="button"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
