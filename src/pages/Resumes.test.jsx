import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import Resumes from "./Resumes";

jest.mock("../auth/AuthProvider", () => ({
  useAuth: jest.fn()
}));

jest.mock("../components/ResumeUploadModal", () => {
  return function ResumeUploadModalMock() {
    return null;
  };
});

jest.mock("../services/resumeAnalysis", () => ({
  analyzeResume: jest.fn(),
  setResumeAnalysisFeedback: jest.fn()
}));

jest.mock("../services/resumes", () => ({
  deleteResumeAndUnlinkApplications: jest.fn(),
  renameResume: jest.fn()
}));

jest.mock("../components/resumesWorkspace/ResumesWorkspaceContext", () => ({
  formatResumeBytes: jest.fn(() => "100 KB"),
  getResumeFileKind: jest.fn(() => "PDF"),
  useResumesWorkspace: jest.fn()
}));

const { useResumesWorkspace } = require("../components/resumesWorkspace/ResumesWorkspaceContext");
const { useAuth } = require("../auth/AuthProvider");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("Resumes page linked applications", () => {
  let container;
  let root;
  let openSpy;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    openSpy = jest.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    useAuth.mockReset();
    useResumesWorkspace.mockReset();
    openSpy.mockRestore();

    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
  });

  function renderPage(overrides = {}) {
    useAuth.mockReturnValue({
      user: { uid: "user-1" }
    });

    useResumesWorkspace.mockReturnValue({
      resumes: [],
      rows: [
        {
          id: "resume-1",
          versionName: "Resume v3",
          fileName: "resume.pdf",
          fileUrl: "https://example.com/resume.pdf",
          fileSize: 1000,
          fileType: "application/pdf",
          uploadDate: new Date("2026-02-01T00:00:00"),
          analyzedAt: null,
          appsCount: 3,
          progressionRate: 50,
          isBest: false,
          feedback: null
        }
      ],
      selectedResume: {
        id: "resume-1",
        versionName: "Resume v3",
        fileName: "resume.pdf",
        fileUrl: "https://example.com/resume.pdf",
        fileSize: 1000,
        fileType: "application/pdf",
        uploadDate: new Date("2026-02-01T00:00:00"),
        analyzedAt: null,
        appsCount: 3,
        progressionRate: 50,
        isBest: false,
        feedback: null,
        analysisResult: null
      },
      selectedVisibleApplications: [
        {
          id: "app-1",
          jobTitle: "Senior Frontend Engineer",
          company: "Acme",
          dateApplied: new Date("2026-02-10T00:00:00"),
          stage: "Interview",
          outcome: "Active",
          jobUrl: "https://example.com/job/1"
        },
        {
          id: "app-2",
          jobTitle: "Product Engineer",
          company: "Northstar",
          dateApplied: new Date("2026-02-18T00:00:00"),
          stage: "Applied",
          outcome: "Active",
          jobUrl: ""
        }
      ],
      selectedStats: {
        interviews: 1,
        avgDaysSince: 10
      },
      setSelectedResumeId: jest.fn(),
      legacyResumeLabels: [],
      loadingResumes: false,
      error: "",
      ...overrides
    });

    act(() => {
      root.render(<Resumes />);
    });
  }

  test("renders linked applications for the selected resume", () => {
    renderPage();

    expect(container.textContent).toContain("Applications");
    expect(container.textContent).toContain("2 linked roles");
    expect(container.textContent).toContain("Senior Frontend Engineer");
    expect(container.textContent).toContain("Acme");
    expect(container.textContent).toContain("Interview");
    expect(container.textContent).toContain("Product Engineer");
    expect(container.textContent).not.toContain("Archived Role");

    const links = Array.from(container.querySelectorAll("a"));
    expect(links.some((link) => link.textContent === "View posting")).toBe(true);
  });

  test("shows an empty state when no visible applications are linked", () => {
    renderPage({
      selectedVisibleApplications: []
    });

    expect(container.textContent).toContain("0 linked roles");
    expect(container.textContent).toContain(
      "No non-archived applications are linked to this resume yet."
    );
  });

  test("shows a preview action for resumes with a file and opens inline PDF preview", () => {
    renderPage();

    const menuToggle = container.querySelector('button[aria-label="Open resume actions menu"]');
    act(() => {
      menuToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const previewButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Preview Selected"
    );
    expect(previewButton).toBeTruthy();
    expect(previewButton.disabled).toBe(false);

    act(() => {
      previewButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Resume preview");
    const frame = container.querySelector("iframe");
    expect(frame).toBeTruthy();
    expect(frame.getAttribute("src")).toBe("https://example.com/resume.pdf");
  });

  test("shows a DOCX fallback instead of an inline frame", () => {
    renderPage({
      rows: [
        {
          id: "resume-1",
          versionName: "Resume v3",
          fileName: "resume.docx",
          fileUrl: "https://example.com/resume.docx",
          fileSize: 1000,
          fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          uploadDate: new Date("2026-02-01T00:00:00"),
          analyzedAt: null,
          appsCount: 3,
          progressionRate: 50,
          isBest: false,
          feedback: null
        }
      ],
      selectedResume: {
        id: "resume-1",
        versionName: "Resume v3",
        fileName: "resume.docx",
        fileUrl: "https://example.com/resume.docx",
        fileSize: 1000,
        fileType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        uploadDate: new Date("2026-02-01T00:00:00"),
        analyzedAt: null,
        appsCount: 3,
        progressionRate: 50,
        isBest: false,
        feedback: null,
        analysisResult: null
      }
    });

    const menuToggle = container.querySelector('button[aria-label="Open resume actions menu"]');
    act(() => {
      menuToggle.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const previewButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Preview Selected"
    );

    act(() => {
      previewButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(container.textContent).toContain("Preview isn’t available for DOCX yet.");
    expect(container.querySelector("iframe")).toBeNull();
  });
});
