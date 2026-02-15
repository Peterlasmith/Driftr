export function computeResumePerformance(resumes, applications) {
  const byId = new Map();
  (resumes || []).forEach((r) => {
    if (!r?.id) return;
    byId.set(r.id, {
      resumeId: r.id,
      applications: 0,
      responded: 0,
      responseRate: null
    });
  });

  (applications || []).forEach((app) => {
    const resumeId = app?.resumeVersionId;
    if (!resumeId) return;
    const perf = byId.get(resumeId);
    if (!perf) return;
    perf.applications += 1;
    if (app?.status && app.status !== "Applied") perf.responded += 1;
  });

  byId.forEach((perf) => {
    if (perf.applications < 5) {
      perf.responseRate = null;
      return;
    }
    if (perf.applications <= 0) {
      perf.responseRate = 0;
      return;
    }
    perf.responseRate = Math.round((perf.responded / perf.applications) * 100);
  });

  const bestResumeId = (() => {
    let best = null;
    byId.forEach((perf) => {
      if (perf.responseRate == null) return;
      if (!best || perf.responseRate > best.responseRate) best = perf;
    });
    return best?.resumeId || null;
  })();

  return { byId, bestResumeId };
}
