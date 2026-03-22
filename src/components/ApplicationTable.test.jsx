import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import ApplicationTable from "./ApplicationTable";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ApplicationTable stale reminders", () => {
  let container;
  let root;

  function renderTable(overrides = {}) {
    const props = {
      applications: [],
      closedOutApplications: [],
      closedOutCollapsed: true,
      onToggleClosedOutCollapse: jest.fn(),
      loading: false,
      onEdit: jest.fn(),
      onDelete: jest.fn(),
      onStatusChange: jest.fn(),
      onArchive: jest.fn(),
      onMoveToNotMovingForward: jest.fn(),
      onDismissStalePrompt: jest.fn(),
      onRequestRecruiterFeedback: jest.fn(),
      statusOptions: ["Applied", "Screening", "Interview", "Offer", "Not moving forward"],
      ...overrides
    };

    act(() => {
      root.render(<ApplicationTable {...props} />);
    });

    return props;
  }

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    container = null;
  });

  test("renders stale prompt and triggers actions", () => {
    const props = renderTable({
      applications: [
        {
          id: "app-1",
          jobTitle: "Frontend Engineer",
          company: "Acme",
          dateApplied: new Date("2026-01-15T00:00:00"),
          status: "Applied",
          staleStatusPrompt: { shouldPrompt: true }
        }
      ]
    });

    expect(container.textContent).toContain("It's been over 30 days with no status update.");

    const buttons = Array.from(container.querySelectorAll("button"));
    const moveButton = buttons.find((button) => button.textContent === "Move to Not moving forward");
    const keepButton = buttons.find((button) => button.textContent === "Keep as is");

    act(() => {
      moveButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      keepButton.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(props.onMoveToNotMovingForward).toHaveBeenCalledWith(
      expect.objectContaining({ id: "app-1" })
    );
    expect(props.onDismissStalePrompt).toHaveBeenCalledWith(
      expect.objectContaining({ id: "app-1" })
    );
  });
});
