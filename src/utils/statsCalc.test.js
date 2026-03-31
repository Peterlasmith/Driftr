import { calcStats } from "./statsCalc";

describe("calcStats interview rate", () => {
  test("returns zero interview metrics for empty applications", () => {
    const stats = calcStats([]);
    expect(stats.interviewReached).toBe(0);
    expect(stats.interviewRate).toBe(0);
  });

  test("counts screening and later stages as interview reached", () => {
    const stats = calcStats([
      { stage: "Applied", outcome: "Active" },
      { stage: "Screening", outcome: "Active" },
      { stage: "Interview", outcome: "Active" },
      { stage: "Offer", outcome: "Active" },
      { stage: "Applied", outcome: "Not moving forward" }
    ]);

    expect(stats.interviewReached).toBe(3);
    expect(stats.interviewRate).toBe(60);
    expect(stats.interviews).toBe(3);
  });

  test("counts persisted and tagged closed-out applications as interview reached", () => {
    const stats = calcStats([
      { stage: "Applied", outcome: "Active" },
      { stage: "Applied", outcome: "Not moving forward", interviewReached: true },
      { stage: "Applied", outcome: "Not moving forward", rejectionReasonTags: ["SCREEN_REJECT"] },
      { stage: "Applied", outcome: "Not moving forward", rejectionReasonTags: ["INTERVIEW_REJECT"] },
      { stage: "Applied", outcome: "Not moving forward", rejectionReasonTags: ["OTHER", "INTERVIEW_REJECT"] },
      { stage: "Applied", outcome: "Not moving forward", rejectionReasonTags: ["UNKNOWN"] }
    ]);

    expect(stats.interviewReached).toBe(4);
    expect(stats.interviewRate).toBe(67);
    expect(stats.interviews).toBe(4);
  });

  test("counts only rejected rows with interview evidence", () => {
    const stats = calcStats([
      { stage: "Applied", outcome: "Not moving forward", rejectionReasonTags: [] },
      { stage: "Applied", outcome: "Not moving forward", rejectionReasonTags: ["SCREEN_REJECT"] },
      { stage: "Applied", outcome: "Not moving forward" },
      { stage: "Applied", outcome: "Active" }
    ]);

    expect(stats.interviewReached).toBe(1);
    expect(stats.interviewRate).toBe(25);
  });

  test("treats not moving forward as non-active while keeping offers active", () => {
    const stats = calcStats([
      { stage: "Applied", outcome: "Active" },
      { stage: "Applied", outcome: "Not moving forward" },
      { stage: "Offer", outcome: "Active" },
      { status: "Rejected" }
    ]);

    expect(stats.active).toBe(2);
  });

  test("uses stage progression instead of outcome for progression rate", () => {
    const stats = calcStats([
      { stage: "Applied", outcome: "Active" },
      { stage: "Interview", outcome: "Not moving forward" },
      { stage: "Applied", outcome: "Not moving forward" }
    ]);

    expect(stats.progressed).toBe(1);
    expect(stats.progressionRate).toBe(33);
  });
});
