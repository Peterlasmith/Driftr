import { findLegacyResumeRelinks } from "./resumeRelinking";

describe("findLegacyResumeRelinks", () => {
  test("matches legacy resume labels to a uniquely named current resume", () => {
    const relinks = findLegacyResumeRelinks(
      [
        { id: "resume-1", versionName: "Resume v1" },
        { id: "resume-2", versionName: "Product Builder" }
      ],
      [
        { id: "app-1", resumeVersion: "Resume v1" },
        { id: "app-2", resumeVersion: "  product builder  " },
        { id: "app-3", resumeVersionId: "resume-1", resumeVersion: "Resume v1" },
        { id: "app-4", resumeVersion: "" }
      ]
    );

    expect(relinks).toEqual([
      { applicationId: "app-1", resumeId: "resume-1" },
      { applicationId: "app-2", resumeId: "resume-2" }
    ]);
  });

  test("skips ambiguous names when multiple resumes share the same label", () => {
    const relinks = findLegacyResumeRelinks(
      [
        { id: "resume-1", versionName: "Resume v1" },
        { id: "resume-2", versionName: "Resume v1" }
      ],
      [{ id: "app-1", resumeVersion: "Resume v1" }]
    );

    expect(relinks).toEqual([]);
  });
});
