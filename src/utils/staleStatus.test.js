import {
  STALE_STATUS_DAYS,
  getStaleStatusPromptState,
  hasDismissedCurrentStalePrompt,
  isClosedOutOutcome,
  normalizeApplicationOutcome,
  normalizeApplicationStage
} from "./staleStatus";

describe("stale status helpers", () => {
  test("normalizes stage and legacy closed outcomes", () => {
    expect(normalizeApplicationStage("Interview")).toBe("Interview");
    expect(normalizeApplicationStage(null)).toBe("Applied");
    expect(normalizeApplicationOutcome(null, "Rejected")).toBe("Not moving forward");
    expect(normalizeApplicationOutcome("Active")).toBe("Active");
  });

  test("treats only not moving forward as closed out", () => {
    expect(isClosedOutOutcome("Active")).toBe(false);
    expect(isClosedOutOutcome("Not moving forward")).toBe(true);
    expect(isClosedOutOutcome(null, "Rejected")).toBe(true);
  });

  test("prompts at 30 days and beyond", () => {
    const app = {
      stage: "Applied",
      outcome: "Active",
      statusChangedAt: new Date("2026-02-20T10:00:00")
    };

    const state = getStaleStatusPromptState(app, new Date("2026-03-22T12:00:00"));
    expect(state.daysSinceStatusChange).toBe(STALE_STATUS_DAYS);
    expect(state.shouldPrompt).toBe(true);
  });

  test("does not prompt before 30 days", () => {
    const state = getStaleStatusPromptState(
      {
        stage: "Applied",
        outcome: "Active",
        statusChangedAt: new Date("2026-02-21T10:00:00")
      },
      new Date("2026-03-22T12:00:00")
    );

    expect(state.shouldPrompt).toBe(false);
  });

  test("excludes closed out and archived applications", () => {
    expect(
      getStaleStatusPromptState(
        { stage: "Offer", outcome: "Active", statusChangedAt: new Date("2026-01-01T00:00:00") },
        new Date("2026-03-22T12:00:00")
      ).shouldPrompt
    ).toBe(false);

    expect(
      getStaleStatusPromptState(
        {
          stage: "Applied",
          outcome: "Not moving forward",
          statusChangedAt: new Date("2026-01-01T00:00:00")
        },
        new Date("2026-03-22T12:00:00")
      ).shouldPrompt
    ).toBe(false);

    expect(
      getStaleStatusPromptState(
        {
          stage: "Applied",
          outcome: "Active",
          statusChangedAt: new Date("2026-01-01T00:00:00"),
          archivedAt: new Date("2026-02-01T00:00:00")
        },
        new Date("2026-03-22T12:00:00")
      ).shouldPrompt
    ).toBe(false);
  });

  test("respects dismissal for the current status window", () => {
    const app = {
      stage: "Applied",
      outcome: "Active",
      statusChangedAt: new Date("2026-02-10T00:00:00"),
      staleStatusPromptDismissedAt: new Date("2026-03-15T00:00:00"),
      staleStatusPromptDismissedForStatus: "Applied"
    };

    expect(hasDismissedCurrentStalePrompt(app)).toBe(true);
    expect(getStaleStatusPromptState(app, new Date("2026-03-22T12:00:00")).shouldPrompt).toBe(false);
  });

  test("re-prompts after the status changes", () => {
    const app = {
      stage: "Interview",
      outcome: "Active",
      statusChangedAt: new Date("2026-02-10T00:00:00"),
      staleStatusPromptDismissedAt: new Date("2026-03-01T00:00:00"),
      staleStatusPromptDismissedForStatus: "Applied"
    };

    expect(hasDismissedCurrentStalePrompt(app)).toBe(false);
    expect(getStaleStatusPromptState(app, new Date("2026-03-22T12:00:00")).shouldPrompt).toBe(true);
  });
});
