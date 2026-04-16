import { computeResumePerformance } from "./resumePerformance";

describe("computeResumePerformance", () => {
  test("counts linked not moving forward and archived applications in resume history", () => {
    const { byId } = computeResumePerformance(
      [{ id: "resume-1" }],
      [
        { resumeVersionId: "resume-1", stage: "Applied", outcome: "Active" },
        { resumeVersionId: "resume-1", stage: "Applied", outcome: "Not moving forward" },
        {
          resumeVersionId: "resume-1",
          stage: "Interview",
          outcome: "Not moving forward",
          archivedAt: new Date("2026-02-01T00:00:00")
        },
        { resumeVersionId: "resume-1", stage: "Screening", outcome: "Active" },
        { resumeVersionId: "resume-1", stage: "Applied", outcome: "Active" },
        { resumeVersionId: "resume-2", stage: "Offer", outcome: "Active" },
        { stage: "Interview", outcome: "Not moving forward" }
      ]
    );

    expect(byId.get("resume-1")).toMatchObject({
      applications: 5,
      progressed: 2,
      progressionRate: 40
    });
  });

  test("keeps progression rate null until a resume has five linked applications", () => {
    const { byId } = computeResumePerformance(
      [{ id: "resume-1" }],
      [
        { resumeVersionId: "resume-1", stage: "Applied" },
        { resumeVersionId: "resume-1", stage: "Interview", outcome: "Not moving forward" },
        { resumeVersionId: "resume-1", stage: "Screening", archivedAt: new Date("2026-02-01T00:00:00") },
        { resumeVersionId: "resume-1", stage: "Applied", outcome: "Not moving forward" }
      ]
    );

    expect(byId.get("resume-1")).toMatchObject({
      applications: 4,
      progressed: 2,
      progressionRate: null
    });
  });

  test("selects the best resume using full linked application history", () => {
    const { byId, bestResumeId } = computeResumePerformance(
      [{ id: "resume-1" }, { id: "resume-2" }, { id: "resume-3" }],
      [
        { resumeVersionId: "resume-1", stage: "Interview" },
        { resumeVersionId: "resume-1", stage: "Screening" },
        { resumeVersionId: "resume-1", stage: "Applied", outcome: "Not moving forward" },
        { resumeVersionId: "resume-1", stage: "Applied" },
        { resumeVersionId: "resume-1", stage: "Applied", archivedAt: new Date("2026-01-01T00:00:00") },
        { resumeVersionId: "resume-2", stage: "Applied" },
        { resumeVersionId: "resume-2", stage: "Applied", outcome: "Not moving forward" },
        { resumeVersionId: "resume-2", stage: "Screening", archivedAt: new Date("2026-01-02T00:00:00") },
        { resumeVersionId: "resume-2", stage: "Interview" },
        { resumeVersionId: "resume-2", stage: "Offer" },
        { resumeVersionId: "resume-3", stage: "Offer" }
      ]
    );

    expect(byId.get("resume-1")?.progressionRate).toBe(40);
    expect(byId.get("resume-2")?.progressionRate).toBe(60);
    expect(byId.get("resume-3")?.progressionRate).toBe(null);
    expect(bestResumeId).toBe("resume-2");
  });
});
