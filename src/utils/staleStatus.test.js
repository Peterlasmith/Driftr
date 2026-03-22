import {
  STALE_STATUS_DAYS,
  getStaleStatusPromptState,
  hasDismissedCurrentStalePrompt,
  isClosedOutStatus,
  normalizeApplicationStatus
} from "./staleStatus";

describe("stale status helpers", () => {
  test("normalizes legacy rejected status to not moving forward", () => {
    expect(normalizeApplicationStatus("Rejected")).toBe("Not moving forward");
    expect(normalizeApplicationStatus("Interview")).toBe("Interview");
  });

  test("treats offer and not moving forward as closed out", () => {
    expect(isClosedOutStatus("Offer")).toBe(true);
    expect(isClosedOutStatus("Not moving forward")).toBe(true);
    expect(isClosedOutStatus("Rejected")).toBe(true);
    expect(isClosedOutStatus("Interview")).toBe(false);
  });

  test("prompts at 30 days and beyond", () => {
    const app = {
      status: "Applied",
      statusChangedAt: new Date("2026-02-20T10:00:00")
    };

    const state = getStaleStatusPromptState(app, new Date("2026-03-22T12:00:00"));
    expect(state.daysSinceStatusChange).toBe(STALE_STATUS_DAYS);
    expect(state.shouldPrompt).toBe(true);
  });

  test("does not prompt before 30 days", () => {
    const state = getStaleStatusPromptState(
      {
        status: "Applied",
        statusChangedAt: new Date("2026-02-21T10:00:00")
      },
      new Date("2026-03-22T12:00:00")
    );

    expect(state.shouldPrompt).toBe(false);
  });

  test("excludes closed out and archived applications", () => {
    expect(
      getStaleStatusPromptState(
        { status: "Offer", statusChangedAt: new Date("2026-01-01T00:00:00") },
        new Date("2026-03-22T12:00:00")
      ).shouldPrompt
    ).toBe(false);

    expect(
      getStaleStatusPromptState(
        {
          status: "Applied",
          statusChangedAt: new Date("2026-01-01T00:00:00"),
          archivedAt: new Date("2026-02-01T00:00:00")
        },
        new Date("2026-03-22T12:00:00")
      ).shouldPrompt
    ).toBe(false);
  });

  test("respects dismissal for the current status window", () => {
    const app = {
      status: "Applied",
      statusChangedAt: new Date("2026-02-10T00:00:00"),
      staleStatusPromptDismissedAt: new Date("2026-03-15T00:00:00"),
      staleStatusPromptDismissedForStatus: "Applied"
    };

    expect(hasDismissedCurrentStalePrompt(app)).toBe(true);
    expect(getStaleStatusPromptState(app, new Date("2026-03-22T12:00:00")).shouldPrompt).toBe(false);
  });

  test("re-prompts after the status changes", () => {
    const app = {
      status: "Interview",
      statusChangedAt: new Date("2026-02-10T00:00:00"),
      staleStatusPromptDismissedAt: new Date("2026-03-01T00:00:00"),
      staleStatusPromptDismissedForStatus: "Applied"
    };

    expect(hasDismissedCurrentStalePrompt(app)).toBe(false);
    expect(getStaleStatusPromptState(app, new Date("2026-03-22T12:00:00")).shouldPrompt).toBe(true);
  });
});
