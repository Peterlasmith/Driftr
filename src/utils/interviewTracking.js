const INTERVIEW_STAGE_STATUSES = new Set(["Screening", "Interview", "Offer"]);
const INTERVIEW_REJECTION_TAGS = new Set(["SCREEN_REJECT", "INTERVIEW_REJECT"]);

export function isInterviewStage(stage) {
  return INTERVIEW_STAGE_STATUSES.has(stage);
}

export function hasInterviewRejectionTag(tags) {
  if (!Array.isArray(tags)) return false;
  return tags.some((tag) => INTERVIEW_REJECTION_TAGS.has(tag));
}

export function hasReachedInterviewStage(application) {
  if (application?.interviewReached === true) return true;
  if (isInterviewStage(application?.stage)) return true;
  if (isInterviewStage(application?.status)) return true;
  return hasInterviewRejectionTag(application?.rejectionReasonTags);
}

export function deriveInterviewReached(currentApplication, nextStage, nextRejectionTags) {
  if (hasReachedInterviewStage(currentApplication)) return true;
  if (isInterviewStage(nextStage)) return true;
  return hasInterviewRejectionTag(nextRejectionTags);
}

export const isInterviewStageStatus = isInterviewStage;
