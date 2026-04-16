import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { subscribeToApplications } from "../../services/applications";
import { relinkLegacyApplications, subscribeToResumes } from "../../services/resumes";
import { computeResumePerformance } from "../../services/resumePerformance";
import { calcStats } from "../../utils/statsCalc";

const ResumesWorkspaceContext = createContext(null);

export function formatResumeBytes(bytes) {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let idx = 0;
  let v = n;
  while (v >= 1024 && idx < units.length - 1) {
    v /= 1024;
    idx += 1;
  }
  return `${v.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

export function getResumeFileKind(resume) {
  const typePart = String(resume?.fileType || "").split("/").pop();
  if (typePart) return typePart.toUpperCase();
  const name = String(resume?.fileName || "");
  const dot = name.lastIndexOf(".");
  if (dot !== -1) return name.slice(dot + 1).toUpperCase();
  return "PDF";
}

export function ResumesWorkspaceProvider({ userId, children }) {
  const [resumes, setResumes] = useState([]);
  const [applications, setApplications] = useState([]);
  const [loadingResumes, setLoadingResumes] = useState(true);
  const [error, setError] = useState("");
  const [selectedResumeId, setSelectedResumeId] = useState("");

  useEffect(() => {
    if (!userId) {
      setResumes([]);
      setApplications([]);
      setLoadingResumes(false);
      setError("");
      setSelectedResumeId("");
      return undefined;
    }

    setLoadingResumes(true);
    setError("");

    const unsubResumes = subscribeToResumes(
      userId,
      (rows) => {
        setResumes(rows);
        setLoadingResumes(false);
      },
      (err) => {
        setError(err?.message || "Failed to load resumes.");
        setResumes([]);
        setLoadingResumes(false);
      }
    );

    const unsubApplications = subscribeToApplications(
      userId,
      (rows) => setApplications(rows),
      () => setApplications([])
    );

    return () => {
      unsubResumes();
      unsubApplications();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    if (!resumes.length || !applications.length) return;
    Promise.resolve(relinkLegacyApplications(userId, resumes, applications)).catch(() => {});
  }, [userId, resumes, applications]);

  const perf = useMemo(() => computeResumePerformance(resumes, applications), [resumes, applications]);

  const rows = useMemo(() => {
    return (resumes || []).map((resume) => {
      const p = perf.byId.get(resume.id);
      return {
        ...resume,
        appsCount: p?.applications ?? 0,
        progressionRate: p?.progressionRate,
        isBest: Boolean(perf.bestResumeId && perf.bestResumeId === resume.id)
      };
    });
  }, [resumes, perf]);

  useEffect(() => {
    if (rows.length === 0) {
      if (selectedResumeId) setSelectedResumeId("");
      return;
    }

    const stillExists = rows.some((row) => row.id === selectedResumeId);
    if (!selectedResumeId || !stillExists) {
      setSelectedResumeId(rows[0].id);
    }
  }, [rows, selectedResumeId]);

  const selectedResume = useMemo(
    () => rows.find((row) => row.id === selectedResumeId) || null,
    [rows, selectedResumeId]
  );

  const selectedApplications = useMemo(() => {
    if (!selectedResume?.id) return [];
    return (applications || []).filter((app) => app?.resumeVersionId === selectedResume.id);
  }, [applications, selectedResume]);

  const selectedVisibleApplications = useMemo(
    () => selectedApplications.filter((app) => !app?.archivedAt),
    [selectedApplications]
  );

  const selectedStats = useMemo(() => calcStats(selectedApplications), [selectedApplications]);

  const legacyResumeLabels = useMemo(() => {
    const set = new Set();
    (applications || []).forEach((application) => {
      if (application?.resumeVersionId) return;
      const label = String(application?.resumeVersion || "").trim();
      if (label) set.add(label);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [applications]);

  const value = useMemo(
    () => ({
      resumes,
      applications,
      rows,
      selectedResumeId,
      setSelectedResumeId,
      selectedResume,
      selectedApplications,
      selectedVisibleApplications,
      selectedStats,
      legacyResumeLabels,
      loadingResumes,
      error,
      setError
    }),
    [
      resumes,
      applications,
      rows,
      selectedResumeId,
      selectedResume,
      selectedApplications,
      selectedVisibleApplications,
      selectedStats,
      legacyResumeLabels,
      loadingResumes,
      error
    ]
  );

  return (
    <ResumesWorkspaceContext.Provider value={value}>
      {children}
    </ResumesWorkspaceContext.Provider>
  );
}

export function useResumesWorkspace() {
  const value = useContext(ResumesWorkspaceContext);
  if (!value) {
    throw new Error("useResumesWorkspace must be used within ResumesWorkspaceProvider.");
  }
  return value;
}
