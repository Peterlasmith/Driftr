const INTERVIEW_STAGE_STATUSES = new Set(["Screening", "Interview", "Offer"]);
const INTERVIEW_REJECTION_TAGS = new Set(["SCREEN_REJECT", "INTERVIEW_REJECT"]);

export function isInterviewStageStatus(status) {
  return INTERVIEW_STAGE_STATUSES.has(status);
}

export function hasInterviewRejectionTag(tags) {
  if (!Array.isArray(tags)) return false;
  return tags.some((tag) => INTERVIEW_REJECTION_TAGS.has(tag));
}

export function hasReachedInterviewStage(application) {
  if (application?.interviewReached === true) return true;
  if (isInterviewStageStatus(application?.status)) return true;
  return hasInterviewRejectionTag(application?.rejectionReasonTags);
}

export function deriveInterviewReached(currentApplication, nextStatus, nextRejectionTags) {
  if (hasReachedInterviewStage(currentApplication)) return true;
  if (isInterviewStageStatus(nextStatus)) return true;
  return hasInterviewRejectionTag(nextRejectionTags);
}
