import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import ApplicationForm from "./ApplicationForm";

jest.mock("../services/jobUrlParser", () => ({
  parseJobUrl: jest.fn().mockResolvedValue({ ok: true })
}));

jest.mock("./ResumeUploadModal", () => {
  return function ResumeUploadModalMock() {
    return null;
  };
});

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

function todayInputValue() {
  const d = new Date();
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function setNativeValue(el, value) {
  const prototype = Object.getPrototypeOf(el);
  const valueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (!valueSetter) throw new Error("Unable to set element value in test.");
  valueSetter.call(el, value);
}

function changeValue(el, value) {
  act(() => {
    setNativeValue(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function changeSelect(el, value) {
  act(() => {
    setNativeValue(el, value);
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("ApplicationForm reset behavior", () => {
  let container;
  let root;

  function renderForm(overrides = {}) {
    const props = {
      open: true,
      saving: false,
      initialValue: null,
      statusOptions: ["Applied", "Screening", "Interview", "Offer", "Not moving forward"],
      resumes: [],
      applications: [],
      onClose: jest.fn(),
      onOpenImport: jest.fn(),
      onSubmit: jest.fn().mockResolvedValue(undefined),
      ...overrides
    };

    act(() => {
      root.render(<ApplicationForm {...props} />);
    });

    return props;
  }

  function getTitleInput() {
    return container.querySelector('input[placeholder="Frontend Engineer"]');
  }

  function getCompanyInput() {
    return container.querySelector('input[placeholder="Acme Inc."]');
  }

  function getLocationInput() {
    return container.querySelector('input[placeholder="San Francisco, CA"]');
  }

  function getDateInput() {
    return container.querySelector('input[type="date"]');
  }

  function getStatusSelect() {
    return container.querySelector("select");
  }

  function getNotesInput() {
    return container.querySelector("textarea");
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

  test("reopens_add_form_with_clean_defaults", () => {
    renderForm({ open: true, initialValue: null });

    changeValue(getTitleInput(), "First Role");
    changeValue(getCompanyInput(), "First Company");
    changeValue(getLocationInput(), "Austin, TX");
    changeValue(getNotesInput(), "Some notes");
    changeSelect(getStatusSelect(), "Interview");

    renderForm({ open: false, initialValue: null });
    renderForm({ open: true, initialValue: null });

    expect(getTitleInput().value).toBe("");
    expect(getCompanyInput().value).toBe("");
    expect(getLocationInput().value).toBe("");
    expect(getNotesInput().value).toBe("");
    expect(getStatusSelect().value).toBe("Applied");
    expect(getDateInput().value).toBe(todayInputValue());
  });

  test("edit_mode_uses_initial_value", () => {
    const initialValue = {
      id: "app-1",
      jobTitle: "Senior Frontend Engineer",
      company: "Acme",
      location: "Remote",
      jobUrl: "https://example.com/jobs/1",
      dateApplied: new Date("2026-02-10T00:00:00"),
      status: "Interview",
      notes: "Panel next week"
    };

    renderForm({ open: true, initialValue });

    expect(getTitleInput().value).toBe("Senior Frontend Engineer");
    expect(getCompanyInput().value).toBe("Acme");
    expect(getLocationInput().value).toBe("Remote");
    expect(getStatusSelect().value).toBe("Interview");
    expect(getDateInput().value).toBe("2026-02-10");

    renderForm({ open: false, initialValue });
    renderForm({ open: true, initialValue });

    expect(getTitleInput().value).toBe("Senior Frontend Engineer");
    expect(getCompanyInput().value).toBe("Acme");
    expect(getLocationInput().value).toBe("Remote");
    expect(getStatusSelect().value).toBe("Interview");
    expect(getDateInput().value).toBe("2026-02-10");
  });

  test("switch_from_edit_to_add_resets", () => {
    const initialValue = {
      id: "app-1",
      jobTitle: "Senior Frontend Engineer",
      company: "Acme",
      dateApplied: new Date("2026-02-10T00:00:00"),
      status: "Interview"
    };

    renderForm({ open: true, initialValue });
    expect(getTitleInput().value).toBe("Senior Frontend Engineer");
    expect(getCompanyInput().value).toBe("Acme");

    renderForm({ open: true, initialValue: null });

    expect(getTitleInput().value).toBe("");
    expect(getCompanyInput().value).toBe("");
    expect(getStatusSelect().value).toBe("Applied");
    expect(getDateInput().value).toBe(todayInputValue());
  });

  test("submit_then_reopen_add_is_clean", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    renderForm({ open: true, initialValue: null, onSubmit });

    changeValue(getTitleInput(), "Role A");
    changeValue(getCompanyInput(), "Company A");

    await act(async () => {
      const form = container.querySelector("form");
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        jobTitle: "Role A",
        company: "Company A",
        status: "Applied"
      })
    );

    renderForm({ open: false, initialValue: null, onSubmit });
    renderForm({ open: true, initialValue: null, onSubmit });

    expect(getTitleInput().value).toBe("");
    expect(getCompanyInput().value).toBe("");
    expect(getStatusSelect().value).toBe("Applied");
    expect(getDateInput().value).toBe(todayInputValue());
  });
});
