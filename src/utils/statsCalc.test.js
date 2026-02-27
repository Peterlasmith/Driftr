import { calcStats } from "./statsCalc";

describe("calcStats interview rate", () => {
  test("returns zero interview metrics for empty applications", () => {
    const stats = calcStats([]);
    expect(stats.interviewReached).toBe(0);
    expect(stats.interviewRate).toBe(0);
  });

  test("counts Interview and Offer statuses as interview reached", () => {
    const stats = calcStats([
      { status: "Applied" },
      { status: "Interview" },
      { status: "Offer" },
      { status: "Screening" }
    ]);

    expect(stats.interviewReached).toBe(2);
    expect(stats.interviewRate).toBe(50);
  });

  test("counts Rejected with INTERVIEW_REJECT tag as interview reached", () => {
    const stats = calcStats([
      { status: "Applied" },
      { status: "Rejected", rejectionReasonTags: ["INTERVIEW_REJECT"] },
      { status: "Rejected", rejectionReasonTags: ["SCREEN_REJECT"] },
      { status: "Rejected", rejectionReasonTags: ["OTHER", "INTERVIEW_REJECT"] }
    ]);

    expect(stats.interviewReached).toBe(2);
    expect(stats.interviewRate).toBe(50);
  });

  test("does not count Rejected without INTERVIEW_REJECT", () => {
    const stats = calcStats([
      { status: "Rejected", rejectionReasonTags: [] },
      { status: "Rejected", rejectionReasonTags: ["SCREEN_REJECT"] },
      { status: "Rejected" },
      { status: "Applied" }
    ]);

    expect(stats.interviewReached).toBe(0);
    expect(stats.interviewRate).toBe(0);
  });
});
