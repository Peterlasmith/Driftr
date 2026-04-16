import { hasReachedInterviewStage } from "../utils/interviewTracking";

// Resume success is a historical metric over all linked applications.
// Archived and closed-out rows still count if they are attached to a resume.
export const MIN_RESUME_APPLICATIONS_FOR_RATE = 1;
export const MIN_RESUME_APPLICATIONS_FOR_BEST = 3;

export function computeResumePerformance(resumes, applications) {
  const byId = new Map();
  (resumes || []).forEach((r) => {
    if (!r?.id) return;
    byId.set(r.id, {
      resumeId: r.id,
      applications: 0,
      interviewReached: 0,
      interviewRate: null,
      lowConfidence: false
    });
  });

  (applications || []).forEach((app) => {
    const resumeId = app?.resumeVersionId;
    if (!resumeId) return;
    const perf = byId.get(resumeId);
    if (!perf) return;
    perf.applications += 1;
    if (hasReachedInterviewStage(app)) perf.interviewReached += 1;
  });

  byId.forEach((perf) => {
    if (perf.applications < MIN_RESUME_APPLICATIONS_FOR_RATE) {
      perf.interviewRate = null;
      perf.lowConfidence = false;
      return;
    }
    if (perf.applications <= 0) {
      perf.interviewRate = 0;
      perf.lowConfidence = false;
      return;
    }
    perf.interviewRate = Math.round((perf.interviewReached / perf.applications) * 100);
    perf.lowConfidence = perf.applications < MIN_RESUME_APPLICATIONS_FOR_BEST;
  });

  const bestResumeId = (() => {
    let best = null;
    byId.forEach((perf) => {
      if (perf.interviewRate == null) return;
      if (perf.applications < MIN_RESUME_APPLICATIONS_FOR_BEST) return;
      if (!best || perf.interviewRate > best.interviewRate) best = perf;
    });
    return best?.resumeId || null;
  })();

  return { byId, bestResumeId };
}
