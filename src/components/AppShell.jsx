import React from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import IconRail from "./IconRail";
import StatsPanel from "./StatsPanel";
import ResumesSidebar from "./ResumesSidebar";
import { ResumesWorkspaceProvider } from "./resumesWorkspace/ResumesWorkspaceContext";
import styles from "./AppShell.module.css";

export default function AppShell({ children }) {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isResumesRoute = pathname === "/resumes" || pathname.startsWith("/resumes/");

  const middleAndMain = isResumesRoute ? (
    <ResumesWorkspaceProvider userId={user?.uid}>
      <ResumesSidebar />
      <main className={styles.main}>
        {children}
      </main>
    </ResumesWorkspaceProvider>
  ) : (
    <>
      <StatsPanel />
      <main className={styles.main}>
        {children}
      </main>
    </>
  );

  return (
    <div className={`${styles.shell} ${isResumesRoute ? styles.shellResumes : ""}`.trim()}>
      <IconRail userEmail={user?.email} />
      {middleAndMain}
    </div>
  );
}
