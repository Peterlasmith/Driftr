import { writeApplicationToFirestore } from "./config/firebase.js";

const STORAGE_KEYS = {
  enabled: "enabled",
  confirmBeforeSave: "confirmBeforeSave",
  queue: "queue",
  lastCaptured: "lastCaptured",
  todaysCount: "todaysCount",
  todaysDate: "todaysDate",
  sessionCount: "sessionCount",
  settings: "settings"
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

async function getState(keys) {
  return chrome.storage.local.get(keys);
}

async function setState(patch) {
  return chrome.storage.local.set(patch);
}

async function getSettings() {
  const { [STORAGE_KEYS.settings]: settings } = await getState([STORAGE_KEYS.settings]);
  return (
    settings || {
      dashboardUrl: ""
    }
  );
}

async function ensureTodayCounter() {
  const state = await getState([STORAGE_KEYS.todaysDate, STORAGE_KEYS.todaysCount]);
  const tk = todayKey();
  if (state[STORAGE_KEYS.todaysDate] !== tk) {
    await setState({ [STORAGE_KEYS.todaysDate]: tk, [STORAGE_KEYS.todaysCount]: 0 });
  }
}

async function bumpCounts() {
  await ensureTodayCounter();
  const state = await getState([STORAGE_KEYS.todaysCount, STORAGE_KEYS.sessionCount]);
  const todaysCount = Number(state[STORAGE_KEYS.todaysCount] || 0) + 1;
  const sessionCount = Number(state[STORAGE_KEYS.sessionCount] || 0) + 1;
  await setState({ [STORAGE_KEYS.todaysCount]: todaysCount, [STORAGE_KEYS.sessionCount]: sessionCount });
  await setBadge(sessionCount);
}

async function setBadge(count) {
  const text = count > 0 ? String(count) : "";
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
}

async function notify(title, message) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: "assets/icon128.png",
      title,
      message
    });
  } catch {
    // ignore
  }
}

async function enqueueApplication(app) {
  const state = await getState([STORAGE_KEYS.queue]);
  const queue = Array.isArray(state[STORAGE_KEYS.queue]) ? state[STORAGE_KEYS.queue] : [];
  queue.push(app);
  await setState({ [STORAGE_KEYS.queue]: queue, [STORAGE_KEYS.lastCaptured]: app });
  await bumpCounts();
}

async function replaceQueue(queue) {
  await setState({ [STORAGE_KEYS.queue]: queue });
}

async function syncOne(app) {
  return writeApplicationToFirestore(app);
}

async function flushQueue({ silent = false } = {}) {
  const state = await getState([STORAGE_KEYS.queue]);
  const queue = Array.isArray(state[STORAGE_KEYS.queue]) ? state[STORAGE_KEYS.queue] : [];
  if (queue.length === 0) return { synced: 0, remaining: 0 };

  const remaining = [];
  let synced = 0;

  for (const app of queue) {
    if (app.status === "pending_confirmation") {
      remaining.push(app);
      continue;
    }
    try {
      await syncOne(app);
      synced += 1;
    } catch (e) {
      remaining.push(app);
      if (!silent) await notify("Driftr Capture: Sync failed", String(e?.message || e));
      break;
    }
  }

  await replaceQueue(remaining);
  if (synced > 0 && !silent) await notify("Driftr Capture", `Synced ${synced} application${synced === 1 ? "" : "s"}.`);
  return { synced, remaining: remaining.length };
}

async function updateEnabled(enabled) {
  await setState({ [STORAGE_KEYS.enabled]: enabled });
  await chrome.action.setBadgeTextColor?.({ color: enabled ? "#ffffff" : "#9ca3af" }).catch?.(() => {});
  await chrome.action.setIcon({
    path: enabled
      ? {
          16: "assets/icon16.png",
          32: "assets/icon32.png",
          48: "assets/icon48.png",
          128: "assets/icon128.png"
        }
      : {
          16: "assets/icon16_off.png",
          32: "assets/icon32_off.png",
          48: "assets/icon48_off.png",
          128: "assets/icon128_off.png"
        }
  });
}

async function getEnabled() {
  const state = await getState([STORAGE_KEYS.enabled]);
  return state[STORAGE_KEYS.enabled] !== false;
}

chrome.runtime.onInstalled.addListener(async () => {
  const enabled = await getEnabled();
  await updateEnabled(enabled);
  await ensureTodayCounter();
  await setState({ [STORAGE_KEYS.sessionCount]: 0 });
  await setBadge(0);
});

chrome.runtime.onStartup?.addListener(async () => {
  const enabled = await getEnabled();
  await updateEnabled(enabled);
  await ensureTodayCounter();
  await setState({ [STORAGE_KEYS.sessionCount]: 0 });
  await setBadge(0);
  await flushQueue({ silent: true });
});

chrome.tabs.onUpdated.addListener(async () => {
  await flushQueue({ silent: true });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (!message || typeof message !== "object") return;

    if (message.type === "getState") {
      const enabled = await getEnabled();
      await ensureTodayCounter();
      const state = await getState([
        STORAGE_KEYS.queue,
        STORAGE_KEYS.lastCaptured,
        STORAGE_KEYS.todaysCount,
        STORAGE_KEYS.sessionCount,
        STORAGE_KEYS.confirmBeforeSave,
        STORAGE_KEYS.settings
      ]);
      sendResponse({
        ok: true,
        enabled,
        queue: state[STORAGE_KEYS.queue] || [],
        lastCaptured: state[STORAGE_KEYS.lastCaptured] || null,
        todaysCount: state[STORAGE_KEYS.todaysCount] || 0,
        sessionCount: state[STORAGE_KEYS.sessionCount] || 0,
        confirmBeforeSave: state[STORAGE_KEYS.confirmBeforeSave] || false,
        settings: state[STORAGE_KEYS.settings] || null
      });
      return;
    }

    if (message.type === "setEnabled") {
      await updateEnabled(Boolean(message.enabled));
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "setConfirmBeforeSave") {
      await setState({ [STORAGE_KEYS.confirmBeforeSave]: Boolean(message.value) });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "saveSettings") {
      const next = {
        dashboardUrl: String(message.settings?.dashboardUrl || "").trim()
      };
      await setState({ [STORAGE_KEYS.settings]: next });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "captureApplication") {
      const enabled = await getEnabled();
      if (!enabled) {
        sendResponse({ ok: false, error: "disabled" });
        return;
      }

      const confirmBeforeSaveState = await getState([STORAGE_KEYS.confirmBeforeSave]);
      const confirmBeforeSave = Boolean(confirmBeforeSaveState[STORAGE_KEYS.confirmBeforeSave]);

      const app = {
        id: crypto.randomUUID(),
        capturedAt: new Date().toISOString(),
        jobTitle: message.application?.jobTitle || "",
        companyName: message.application?.companyName || "",
        jobUrl: message.application?.jobUrl || sender?.tab?.url || "",
        resumeFileName: message.application?.resumeFileName || "",
        source: message.application?.source || "",
        status: confirmBeforeSave ? "pending_confirmation" : "queued"
      };

      await enqueueApplication(app);

      if (confirmBeforeSave) {
        await notify("Driftr Capture", "Captured application (needs confirmation in popup).");
        sendResponse({ ok: true, status: "pending_confirmation" });
        return;
      }

      const result = await flushQueue({ silent: false });
      sendResponse({ ok: true, status: "queued", synced: result.synced, remaining: result.remaining });
      return;
    }

    if (message.type === "updateQueuedApplication") {
      const state = await getState([STORAGE_KEYS.queue]);
      const queue = Array.isArray(state[STORAGE_KEYS.queue]) ? state[STORAGE_KEYS.queue] : [];
      const next = queue.map((q) => {
        if (q.id !== message.id) return q;
        return { ...q, ...message.patch };
      });
      await replaceQueue(next);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "confirmAndSync") {
      const state = await getState([STORAGE_KEYS.queue]);
      const queue = Array.isArray(state[STORAGE_KEYS.queue]) ? state[STORAGE_KEYS.queue] : [];
      const next = queue.map((q) => (q.id === message.id ? { ...q, status: "queued" } : q));
      await replaceQueue(next);
      const result = await flushQueue({ silent: false });
      sendResponse({ ok: true, synced: result.synced, remaining: result.remaining });
      return;
    }

    if (message.type === "flushQueue") {
      const result = await flushQueue({ silent: false });
      sendResponse({ ok: true, ...result });
      return;
    }
  })()
    .then(() => {})
    .catch((e) => {
      sendResponse({ ok: false, error: String(e?.message || e) });
    });

  return true;
});
