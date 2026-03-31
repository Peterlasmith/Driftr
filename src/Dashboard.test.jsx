import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import Dashboard from "./Dashboard";

jest.mock("./auth/AuthProvider", () => ({
  useAuth: jest.fn()
}));

jest.mock("./services/applications", () => ({
  APPLICATION_STAGE_OPTIONS: ["Applied", "Screening", "Interview", "Offer"],
  APPLICATION_OUTCOME_OPTIONS: ["Active", "Not moving forward"],
  archiveApplication: jest.fn(),
  createApplication: jest.fn(),
  deleteApplication: jest.fn(),
  dismissStaleStatusPrompt: jest.fn(),
  subscribeToApplications: jest.fn(),
  updateApplication: jest.fn(),
  updateApplicationOutcomeWithRejectionMeta: jest.fn(),
  updateApplicationStage: jest.fn()
}));

jest.mock("./services/resumes", () => ({
  subscribeToResumes: jest.fn()
}));

jest.mock("./services/userPreferences", () => ({
  DEFAULT_USER_PREFERENCES: {},
  subscribeToUserPreferences: jest.fn()
}));

let latestTableProps = null;

jest.mock("./components/ApplicationTable", () => {
  return function ApplicationTableMock(props) {
    latestTableProps = props;
    const firstApp = props.applications?.[0] || null;
    const isPending = firstApp ? Boolean(props.statusUpdatePendingIds?.[firstApp.id]) : false;
    const showPrompt = firstApp?.staleStatusPrompt?.shouldPrompt ? "yes" : "no";

    return (
      <div>
        <div data-testid="prompt-visible">{showPrompt}</div>
        <div data-testid="pending-state">{isPending ? "pending" : "idle"}</div>
        <button
          type="button"
          data-testid="change-status"
          onClick={() => {
            if (firstApp) props.onStatusChange(firstApp, "Interview");
          }}
        >
          Change status
        </button>
      </div>
    );
  };
});

jest.mock("./components/ApplicationForm", () => {
  return function ApplicationFormMock() {
    return null;
  };
});

jest.mock("./components/ApplicationCsvImportModal", () => {
  return function ApplicationCsvImportModalMock() {
    return null;
  };
});

const { useAuth } = require("./auth/AuthProvider");
const {
  subscribeToApplications,
  updateApplicationStage
} = require("./services/applications");
const { subscribeToResumes } = require("./services/resumes");
const { subscribeToUserPreferences } = require("./services/userPreferences");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function flushPromises() {
  return Promise.resolve();
}

function createDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("Dashboard status update pending state", () => {
  let container;
  let root;

  const app = {
    id: "app-1",
    jobTitle: "Frontend Engineer",
    company: "Acme",
    dateApplied: new Date("2026-01-15T00:00:00"),
    stage: "Applied",
    outcome: "Active",
    statusChangedAt: new Date("2026-02-01T00:00:00"),
    archivedAt: null
  };

  beforeEach(() => {
    latestTableProps = null;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    useAuth.mockReturnValue({
      user: { uid: "user-1" }
    });

    subscribeToApplications.mockImplementation((userId, onData) => {
      onData([app]);
      return jest.fn();
    });

    subscribeToResumes.mockImplementation((userId, onData) => {
      onData([]);
      return jest.fn();
    });

    subscribeToUserPreferences.mockImplementation((userId, onData) => {
      onData({});
      return jest.fn();
    });
  });

  afterEach(() => {
    useAuth.mockReset();
    subscribeToApplications.mockReset();
    subscribeToResumes.mockReset();
    subscribeToUserPreferences.mockReset();
    updateApplicationStage.mockReset();

    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
  });

  function renderDashboard() {
    act(() => {
      root.render(<Dashboard />);
    });
  }

  test("hides stale prompt while status update is in flight and clears pending state on success", async () => {
    const deferred = createDeferred();
    updateApplicationStage.mockReturnValue(deferred.promise);

    renderDashboard();

    expect(latestTableProps.statusUpdatePendingIds).toEqual({});
    expect(container.querySelector('[data-testid="prompt-visible"]').textContent).toBe("yes");
    expect(container.querySelector('[data-testid="pending-state"]').textContent).toBe("idle");

    await act(async () => {
      container
        .querySelector('[data-testid="change-status"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(updateApplicationStage).toHaveBeenCalledWith("user-1", "app-1", "Interview");
    expect(latestTableProps.statusUpdatePendingIds).toEqual({ "app-1": true });
    expect(container.querySelector('[data-testid="prompt-visible"]').textContent).toBe("no");
    expect(container.querySelector('[data-testid="pending-state"]').textContent).toBe("pending");

    await act(async () => {
      deferred.resolve();
      await deferred.promise;
    });

    expect(latestTableProps.statusUpdatePendingIds).toEqual({});
    expect(container.querySelector('[data-testid="pending-state"]').textContent).toBe("idle");
  });

  test("clears pending state when status update fails", async () => {
    const deferred = createDeferred();
    updateApplicationStage.mockReturnValue(deferred.promise);

    renderDashboard();

    await act(async () => {
      container
        .querySelector('[data-testid="change-status"]')
        .dispatchEvent(new MouseEvent("click", { bubbles: true }));
      await flushPromises();
    });

    expect(latestTableProps.statusUpdatePendingIds).toEqual({ "app-1": true });

    await act(async () => {
      deferred.reject(new Error("Network failed"));
      try {
        await deferred.promise;
      } catch {}
    });

    expect(latestTableProps.statusUpdatePendingIds).toEqual({});
    expect(container.querySelector('[data-testid="pending-state"]').textContent).toBe("idle");
    expect(container.textContent).toContain("Network failed");
  });
});
