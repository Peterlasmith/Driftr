function normalizeResumeLabel(value) {
  return String(value || "").trim().toLowerCase();
}

export function findLegacyResumeRelinks(resumes, applications) {
  const resumeIdsByLabel = new Map();

  (resumes || []).forEach((resume) => {
    const label = normalizeResumeLabel(resume?.versionName);
    if (!label || !resume?.id) return;
    const current = resumeIdsByLabel.get(label) || [];
    current.push(resume.id);
    resumeIdsByLabel.set(label, current);
  });

  return (applications || [])
    .map((application) => {
      if (!application?.id) return null;
      if (application?.resumeVersionId) return null;
      const label = normalizeResumeLabel(application?.resumeVersion);
      if (!label) return null;
      const matchingResumeIds = resumeIdsByLabel.get(label) || [];
      if (matchingResumeIds.length !== 1) return null;
      return {
        applicationId: application.id,
        resumeId: matchingResumeIds[0]
      };
    })
    .filter(Boolean);
}
