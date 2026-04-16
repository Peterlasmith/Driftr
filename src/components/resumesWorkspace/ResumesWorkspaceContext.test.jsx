import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ResumesWorkspaceProvider, useResumesWorkspace } from "./ResumesWorkspaceContext";

jest.mock("../../services/applications", () => ({
  subscribeToApplications: jest.fn()
}));

jest.mock("../../services/resumes", () => ({
  subscribeToResumes: jest.fn(),
  relinkLegacyApplications: jest.fn(() => Promise.resolve(0))
}));

const { subscribeToApplications } = require("../../services/applications");
const { subscribeToResumes, relinkLegacyApplications } = require("../../services/resumes");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ onValue }) {
  const value = useResumesWorkspace();

  React.useEffect(() => {
    onValue(value);
  }, [value, onValue]);

  return null;
}

describe("ResumesWorkspaceProvider", () => {
  let container;
  let root;
  let lastValue;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    lastValue = null;

    subscribeToResumes.mockImplementation((userId, onData) => {
      onData([
        { id: "resume-1", versionName: "Resume One" },
        { id: "resume-2", versionName: "Resume Two" }
      ]);
      return () => {};
    });

    subscribeToApplications.mockImplementation((userId, onData) => {
      onData([
        {
          id: "app-1",
          resumeVersionId: "resume-1",
          archivedAt: null,
          jobTitle: "Frontend Engineer"
        },
        {
          id: "app-2",
          resumeVersionId: "resume-1",
          archivedAt: new Date("2026-02-01T00:00:00"),
          jobTitle: "Archived Role"
        },
        {
          id: "app-3",
          resumeVersionId: "resume-2",
          archivedAt: null,
          jobTitle: "Product Designer"
        }
      ]);
      return () => {};
    });
  });

  afterEach(() => {
    subscribeToApplications.mockReset();
    subscribeToResumes.mockReset();
    relinkLegacyApplications.mockReset();
    relinkLegacyApplications.mockImplementation(() => Promise.resolve(0));

    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
  });

  function renderProvider() {
    act(() => {
      root.render(
        <ResumesWorkspaceProvider userId="user-1">
          <Probe
            onValue={(value) => {
              lastValue = value;
            }}
          />
        </ResumesWorkspaceProvider>
      );
    });
  }

  test("exposes selected visible applications for the chosen resume", () => {
    renderProvider();

    expect(lastValue.selectedResume?.id).toBe("resume-1");
    expect(lastValue.selectedApplications.map((app) => app.id)).toEqual(["app-1", "app-2"]);
    expect(lastValue.selectedVisibleApplications.map((app) => app.id)).toEqual(["app-1"]);

    act(() => {
      lastValue.setSelectedResumeId("resume-2");
    });

    expect(lastValue.selectedResume?.id).toBe("resume-2");
    expect(lastValue.selectedApplications.map((app) => app.id)).toEqual(["app-3"]);
    expect(lastValue.selectedVisibleApplications.map((app) => app.id)).toEqual(["app-3"]);
  });
});
