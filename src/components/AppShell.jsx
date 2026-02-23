import React from "react";
import { useAuth } from "../auth/AuthProvider";
import IconRail from "./IconRail";
import StatsPanel from "./StatsPanel";
import styles from "./AppShell.module.css";

export default function AppShell({ children }) {
  const { user } = useAuth();

  return (
    <div className={styles.shell}>
      <IconRail userEmail={user?.email} />
      <StatsPanel />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
