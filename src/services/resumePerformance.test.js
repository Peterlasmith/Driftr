import { computeResumePerformance } from "./resumePerformance";

describe("computeResumePerformance", () => {
  test("counts linked not moving forward and archived applications in interview history", () => {
    const { byId } = computeResumePerformance(
      [{ id: "resume-1" }],
      [
        { resumeVersionId: "resume-1", stage: "Applied", outcome: "Active" },
        { resumeVersionId: "resume-1", stage: "Applied", outcome: "Not moving forward" },
        {
          resumeVersionId: "resume-1",
          stage: "Applied",
          interviewReached: true,
          outcome: "Not moving forward",
          archivedAt: new Date("2026-02-01T00:00:00")
        },
        { resumeVersionId: "resume-1", stage: "Applied", rejectionReasonTags: ["SCREEN_REJECT"] },
        { resumeVersionId: "resume-1", stage: "Applied", outcome: "Active" },
        { resumeVersionId: "resume-2", stage: "Offer", outcome: "Active" },
        { stage: "Interview", outcome: "Not moving forward" }
      ]
    );

    expect(byId.get("resume-1")).toMatchObject({
      applications: 5,
      interviewReached: 2,
      interviewRate: 40,
      lowConfidence: false
    });
  });

  test("shows interview rate for small samples while marking them low confidence", () => {
    const { byId } = computeResumePerformance(
      [{ id: "resume-1" }],
      [
        { resumeVersionId: "resume-1", stage: "Applied" },
        { resumeVersionId: "resume-1", stage: "Interview", outcome: "Not moving forward" },
        { resumeVersionId: "resume-1", stage: "Applied", rejectionReasonTags: ["INTERVIEW_REJECT"], archivedAt: new Date("2026-02-01T00:00:00") },
        { resumeVersionId: "resume-1", stage: "Applied", outcome: "Not moving forward" }
      ]
    );

    expect(byId.get("resume-1")).toMatchObject({
      applications: 4,
      interviewReached: 2,
      interviewRate: 50,
      lowConfidence: false
    });
  });

  test("keeps interview rate hidden only when a resume has no linked applications", () => {
    const { byId } = computeResumePerformance([{ id: "resume-1" }], []);

    expect(byId.get("resume-1")).toMatchObject({
      applications: 0,
      interviewReached: 0,
      interviewRate: null,
      lowConfidence: false
    });
  });

  test("marks one- and two-application samples as low confidence", () => {
    const { byId } = computeResumePerformance(
      [{ id: "resume-1" }, { id: "resume-2" }],
      [
        { resumeVersionId: "resume-1", stage: "Screening" },
        { resumeVersionId: "resume-2", stage: "Applied" },
        { resumeVersionId: "resume-2", stage: "Applied", outcome: "Not moving forward" }
      ]
    );

    expect(byId.get("resume-1")).toMatchObject({
      applications: 1,
      interviewRate: 100,
      lowConfidence: true
    });
    expect(byId.get("resume-2")).toMatchObject({
      applications: 2,
      interviewRate: 0,
      lowConfidence: true
    });
  });

  test("selects the best resume using linked interview rate once it has three linked applications", () => {
    const { byId, bestResumeId } = computeResumePerformance(
      [{ id: "resume-1" }, { id: "resume-2" }, { id: "resume-3" }, { id: "resume-4" }],
      [
        { resumeVersionId: "resume-1", stage: "Interview" },
        { resumeVersionId: "resume-1", stage: "Applied", rejectionReasonTags: ["SCREEN_REJECT"] },
        { resumeVersionId: "resume-1", stage: "Applied", outcome: "Not moving forward" },
        { resumeVersionId: "resume-1", stage: "Applied" },
        { resumeVersionId: "resume-1", stage: "Applied", archivedAt: new Date("2026-01-01T00:00:00") },
        { resumeVersionId: "resume-2", stage: "Applied" },
        { resumeVersionId: "resume-2", stage: "Applied", outcome: "Not moving forward" },
        { resumeVersionId: "resume-2", stage: "Screening" },
        { resumeVersionId: "resume-3", stage: "Offer" },
        { resumeVersionId: "resume-4", stage: "Offer" },
        { resumeVersionId: "resume-4", stage: "Applied", interviewReached: true },
        { resumeVersionId: "resume-4", stage: "Applied" }
      ]
    );

    expect(byId.get("resume-1")?.interviewRate).toBe(40);
    expect(byId.get("resume-2")).toMatchObject({ interviewRate: 33, lowConfidence: false });
    expect(byId.get("resume-3")).toMatchObject({ interviewRate: 100, lowConfidence: true });
    expect(byId.get("resume-4")).toMatchObject({ interviewRate: 67, lowConfidence: false });
    expect(bestResumeId).toBe("resume-4");
  });
});
