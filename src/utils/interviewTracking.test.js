import {
  deriveInterviewReached,
  hasReachedInterviewStage,
  hasInterviewRejectionTag,
  isInterviewStageStatus
} from "./interviewTracking";

describe("interview tracking helpers", () => {
  test("recognizes screening and later statuses as interview stages", () => {
    expect(isInterviewStageStatus("Applied")).toBe(false);
    expect(isInterviewStageStatus("Screening")).toBe(true);
    expect(isInterviewStageStatus("Interview")).toBe(true);
    expect(isInterviewStageStatus("Offer")).toBe(true);
  });

  test("recognizes qualifying rejection tags", () => {
    expect(hasInterviewRejectionTag(["SCREEN_REJECT"])).toBe(true);
    expect(hasInterviewRejectionTag(["INTERVIEW_REJECT"])).toBe(true);
    expect(hasInterviewRejectionTag(["UNKNOWN"])).toBe(false);
  });

  test("uses persisted flag and legacy fallbacks on reads", () => {
    expect(hasReachedInterviewStage({ status: "Rejected", interviewReached: true })).toBe(true);
    expect(hasReachedInterviewStage({ status: "Screening" })).toBe(true);
    expect(hasReachedInterviewStage({ status: "Rejected", rejectionReasonTags: ["SCREEN_REJECT"] })).toBe(true);
    expect(hasReachedInterviewStage({ status: "Rejected", rejectionReasonTags: ["UNKNOWN"] })).toBe(false);
  });

  test("preserves interview history after moving backward in status", () => {
    const current = { status: "Interview" };
    expect(deriveInterviewReached(current, "Not moving forward", [])).toBe(true);
    expect(deriveInterviewReached(current, "Applied", [])).toBe(true);
  });

  test("marks direct rejection with qualifying feedback as interview reached", () => {
    expect(deriveInterviewReached(null, "Not moving forward", ["SCREEN_REJECT"])).toBe(true);
    expect(deriveInterviewReached(null, "Not moving forward", ["INTERVIEW_REJECT"])).toBe(true);
    expect(deriveInterviewReached(null, "Not moving forward", ["UNKNOWN"])).toBe(false);
  });
});
