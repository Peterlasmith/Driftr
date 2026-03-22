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
      { status: "Screening" },
      { status: "Interview" },
      { status: "Offer" },
      { status: "Not moving forward" }
    ]);

    expect(stats.interviewReached).toBe(3);
    expect(stats.interviewRate).toBe(60);
    expect(stats.interviews).toBe(3);
  });

  test("counts persisted and tagged rejected applications as interview reached", () => {
    const stats = calcStats([
      { status: "Applied" },
      { status: "Not moving forward", interviewReached: true },
      { status: "Not moving forward", rejectionReasonTags: ["SCREEN_REJECT"] },
      { status: "Not moving forward", rejectionReasonTags: ["INTERVIEW_REJECT"] },
      { status: "Not moving forward", rejectionReasonTags: ["OTHER", "INTERVIEW_REJECT"] },
      { status: "Not moving forward", rejectionReasonTags: ["UNKNOWN"] }
    ]);

    expect(stats.interviewReached).toBe(4);
    expect(stats.interviewRate).toBe(67);
    expect(stats.interviews).toBe(4);
  });

  test("counts only rejected rows with interview evidence", () => {
    const stats = calcStats([
      { status: "Not moving forward", rejectionReasonTags: [] },
      { status: "Not moving forward", rejectionReasonTags: ["SCREEN_REJECT"] },
      { status: "Not moving forward" },
      { status: "Applied" }
    ]);

    expect(stats.interviewReached).toBe(1);
    expect(stats.interviewRate).toBe(25);
  });

  test("treats not moving forward as non-active", () => {
    const stats = calcStats([
      { status: "Applied" },
      { status: "Not moving forward" },
      { status: "Offer" },
      { status: "Rejected" }
    ]);

    expect(stats.active).toBe(1);
  });
});
