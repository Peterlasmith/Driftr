export const STALE_STATUS_DAYS = 30;
export const APPLICATION_STAGE_OPTIONS = ["Applied", "Screening", "Interview", "Offer"];
export const APPLICATION_OUTCOME_OPTIONS = ["Active", "Not moving forward"];

function toMidnight(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function normalizeApplicationStage(stage) {
  if (stage == null || stage === "") return "Applied";
  return APPLICATION_STAGE_OPTIONS.includes(stage) ? stage : "Applied";
}

export function normalizeApplicationOutcome(outcome, legacyStatus = null) {
  if (outcome === "Rejected") return "Not moving forward";
  if (APPLICATION_OUTCOME_OPTIONS.includes(outcome)) return outcome;
  if (legacyStatus === "Rejected" || legacyStatus === "Not moving forward") {
    return "Not moving forward";
  }
  return "Active";
}

export function isClosedOutOutcome(outcome, legacyStatus = null) {
  return normalizeApplicationOutcome(outcome, legacyStatus) === "Not moving forward";
}

export function getDaysSinceStatusChange(statusChangedAt, now = new Date()) {
  const start = toMidnight(statusChangedAt);
  const end = toMidnight(now);
  if (!start || !end) return null;
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

export function hasDismissedCurrentStalePrompt(application) {
  if (!application?.staleStatusPromptDismissedAt) return false;
  const currentStage = normalizeApplicationStage(application?.stage ?? application?.status);
  const dismissedForStage = normalizeApplicationStage(
    application?.staleStatusPromptDismissedForStatus
  );
  return Boolean(currentStage) && dismissedForStage === currentStage;
}

export function getStaleStatusPromptState(application, now = new Date()) {
  const normalizedStage = normalizeApplicationStage(application?.stage ?? application?.status);
  const normalizedOutcome = normalizeApplicationOutcome(application?.outcome, application?.status);
  const daysSinceStatusChange = getDaysSinceStatusChange(application?.statusChangedAt, now);
  const dismissed = hasDismissedCurrentStalePrompt(application);
  const eligible =
    !application?.archivedAt &&
    !isClosedOutOutcome(normalizedOutcome) &&
    normalizedStage !== "Offer" &&
    typeof daysSinceStatusChange === "number" &&
    daysSinceStatusChange >= STALE_STATUS_DAYS;

  return {
    daysSinceStatusChange,
    dismissed,
    eligible,
    shouldPrompt: eligible && !dismissed
  };
}
