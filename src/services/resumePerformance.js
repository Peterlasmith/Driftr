import { normalizeApplicationStage } from "../utils/staleStatus";

// Resume performance is a historical metric over all linked applications.
// Archived and closed-out rows still count if they are attached to a resume.
export function computeResumePerformance(resumes, applications) {
  const byId = new Map();
  (resumes || []).forEach((r) => {
    if (!r?.id) return;
    byId.set(r.id, {
      resumeId: r.id,
      applications: 0,
      progressed: 0,
      progressionRate: null
    });
  });

  (applications || []).forEach((app) => {
    const resumeId = app?.resumeVersionId;
    if (!resumeId) return;
    const perf = byId.get(resumeId);
    if (!perf) return;
    perf.applications += 1;
    if (normalizeApplicationStage(app?.stage ?? app?.status) !== "Applied") perf.progressed += 1;
  });

  byId.forEach((perf) => {
    if (perf.applications < 5) {
      perf.progressionRate = null;
      return;
    }
    if (perf.applications <= 0) {
      perf.progressionRate = 0;
      return;
    }
    perf.progressionRate = Math.round((perf.progressed / perf.applications) * 100);
  });

  const bestResumeId = (() => {
    let best = null;
    byId.forEach((perf) => {
      if (perf.progressionRate == null) return;
      if (!best || perf.progressionRate > best.progressionRate) best = perf;
    });
    return best?.resumeId || null;
  })();

  return { byId, bestResumeId };
}
