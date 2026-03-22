export const STALE_STATUS_DAYS = 30;

function toMidnight(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

export function normalizeApplicationStatus(status) {
  if (status === "Rejected") return "Not moving forward";
  return status == null ? "Applied" : status;
}

export function isClosedOutStatus(status) {
  const normalized = normalizeApplicationStatus(status);
  return normalized === "Offer" || normalized === "Not moving forward";
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
  const currentStatus = normalizeApplicationStatus(application?.status);
  const dismissedForStatus = normalizeApplicationStatus(
    application?.staleStatusPromptDismissedForStatus
  );
  return Boolean(currentStatus) && dismissedForStatus === currentStatus;
}

export function getStaleStatusPromptState(application, now = new Date()) {
  const normalizedStatus = normalizeApplicationStatus(application?.status);
  const daysSinceStatusChange = getDaysSinceStatusChange(application?.statusChangedAt, now);
  const dismissed = hasDismissedCurrentStalePrompt(application);
  const eligible =
    !application?.archivedAt &&
    !isClosedOutStatus(normalizedStatus) &&
    typeof daysSinceStatusChange === "number" &&
    daysSinceStatusChange >= STALE_STATUS_DAYS;

  return {
    daysSinceStatusChange,
    dismissed,
    eligible,
    shouldPrompt: eligible && !dismissed
  };
}
