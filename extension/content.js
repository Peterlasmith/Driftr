import { detectSource, extract } from "./utils/extractors.js";

const CAPTURE_NAMESPACE = "driftr_capture";
let lastUrl = location.href;
let lastResumeFileName = "";
let lastInteractionAt = 0;
let indicatorEl = null;

function isButtonLike(el) {
  if (!el) return false;
  const tag = el.tagName?.toLowerCase?.();
  return tag === "button" || (tag === "a" && el.getAttribute("role") === "button") || el.getAttribute("type") === "submit";
}

function getButtonText(el) {
  const txt = (el.innerText || el.getAttribute("aria-label") || el.value || "").trim();
  return txt.toLowerCase();
}

function isApplyClick(text) {
  return text.includes("apply") && !text.includes("applied");
}

function isSubmitClick(text) {
  return (
    text.includes("submit application") ||
    text === "submit" ||
    text.includes("submit") ||
    text.includes("finish") ||
    text.includes("complete application")
  );
}

function nowMs() {
  return Date.now();
}

function getSource() {
  return detectSource(location.href);
}

async function getEnabled() {
  try {
    const resp = await chrome.runtime.sendMessage({ type: "getState" });
    return resp?.enabled !== false;
  } catch {
    return false;
  }
}

function ensureIndicator(enabled) {
  if (!enabled) {
    if (indicatorEl) indicatorEl.remove();
    indicatorEl = null;
    return;
  }

  if (indicatorEl) return;
  indicatorEl = document.createElement("div");
  indicatorEl.id = `${CAPTURE_NAMESPACE}_indicator`;
  const root = indicatorEl.attachShadow({ mode: "open" });
  const wrap = document.createElement("div");
  wrap.textContent = "Tracking ON";
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; }
    div {
      position: fixed;
      z-index: 2147483647;
      right: 12px;
      bottom: 12px;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(37, 99, 235, 0.92);
      color: #fff;
      font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      box-shadow: 0 6px 18px rgba(0,0,0,0.18);
      user-select: none;
      pointer-events: none;
    }
  `;
  root.appendChild(style);
  root.appendChild(wrap);
  document.documentElement.appendChild(indicatorEl);
}

function captureFromPage() {
  const source = getSource();
  const extracted = extract(location.href, document);
  return {
    jobTitle: extracted.jobTitle || "",
    companyName: extracted.companyName || "",
    jobUrl: location.href,
    resumeFileName: lastResumeFileName || extracted.resumeFileName || "",
    source
  };
}

async function sendCapture(reason) {
  const enabled = await getEnabled();
  ensureIndicator(enabled);
  if (!enabled) return;
  const application = captureFromPage();
  if (!application.jobTitle && !application.companyName) return;
  try {
    await chrome.runtime.sendMessage({ type: "captureApplication", reason, application });
  } catch {
    // ignore
  }
}

function installFileUploadListener() {
  document.addEventListener(
    "change",
    (e) => {
      const t = e.target;
      if (!t || t.tagName?.toLowerCase?.() !== "input") return;
      if (t.getAttribute("type") !== "file") return;
      const files = t.files;
      if (!files || files.length === 0) return;
      lastResumeFileName = files[0]?.name || "";
      lastInteractionAt = nowMs();
    },
    true
  );
}

function installFormSubmitListener() {
  document.addEventListener(
    "submit",
    () => {
      lastInteractionAt = nowMs();
      void sendCapture("form_submit");
    },
    true
  );
}

function installClickListener() {
  document.addEventListener(
    "click",
    (e) => {
      const path = e.composedPath?.() || [];
      const candidate = path.find(isButtonLike) || e.target;
      if (!candidate) return;

      const txt = getButtonText(candidate);
      if (!txt) return;

      if (isApplyClick(txt)) {
        lastInteractionAt = nowMs();
        // capture a draft immediately (helps if submit is SPA-driven)
        void sendCapture("apply_click");
        return;
      }

      if (isSubmitClick(txt)) {
        lastInteractionAt = nowMs();
        void sendCapture("submit_click");
      }
    },
    true
  );
}

function installUrlChangeWatcher() {
  const tick = async () => {
    if (location.href !== lastUrl) {
      const prev = lastUrl;
      lastUrl = location.href;

      const enabled = await getEnabled();
      ensureIndicator(enabled);
      if (!enabled) return;

      // Fallback: if user interacted recently and navigated away, treat as likely submit.
      if (nowMs() - lastInteractionAt < 20_000) {
        void chrome.runtime.sendMessage({
          type: "captureApplication",
          reason: "url_change_after_interaction",
          application: {
            ...captureFromPage(),
            jobUrl: prev
          }
        });
      }
    }
  };
  setInterval(() => void tick(), 1000);
}

function installMutationObserver() {
  const obs = new MutationObserver(async () => {
    const enabled = await getEnabled();
    ensureIndicator(enabled);
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

async function init() {
  const enabled = await getEnabled();
  ensureIndicator(enabled);
  installFileUploadListener();
  installFormSubmitListener();
  installClickListener();
  installUrlChangeWatcher();
  installMutationObserver();
}

void init();
