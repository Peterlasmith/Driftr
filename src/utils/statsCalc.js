import { hasReachedInterviewStage } from "./interviewTracking";
import { isClosedOutStatus } from "./staleStatus";

export function daysSince(dateApplied) {
  if (!dateApplied) return null;
  const start = new Date(dateApplied);
  const today = new Date();
  start.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

export function calcStats(applications) {
  const total = applications.length;
  const active = applications.filter((a) => !isClosedOutStatus(a.status)).length;
  const responded = applications.filter((a) => a.status !== "Applied").length;
  const responseRate = total === 0 ? 0 : Math.round((responded / total) * 100);
  const interviewReached = applications.filter(hasReachedInterviewStage).length;
  const interviewRate = total === 0 ? 0 : Math.round((interviewReached / total) * 100);

  const dayValues = applications
    .map((a) => daysSince(a.dateApplied))
    .filter((n) => typeof n === "number");
  const avgDaysSince =
    dayValues.length === 0
      ? 0
      : Math.round(dayValues.reduce((sum, n) => sum + n, 0) / dayValues.length);

  const interviews = interviewReached;

  return {
    total,
    active,
    responseRate,
    avgDaysSince,
    responded,
    interviews,
    interviewReached,
    interviewRate
  };
}

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getInitials(email) {
  if (!email) return "?";
  const name = email.split("@")[0];
  const parts = name.split(/[._-]/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}
