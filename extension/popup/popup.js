function $(id) {
  return document.getElementById(id);
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getState() {
  return chrome.runtime.sendMessage({ type: "getState" });
}

async function setEnabled(enabled) {
  return chrome.runtime.sendMessage({ type: "setEnabled", enabled });
}

async function setConfirmBeforeSave(value) {
  return chrome.runtime.sendMessage({ type: "setConfirmBeforeSave", value });
}

async function saveSettings(settings) {
  return chrome.runtime.sendMessage({ type: "saveSettings", settings });
}

async function flushQueue() {
  return chrome.runtime.sendMessage({ type: "flushQueue" });
}

async function updateQueuedApplication(id, patch) {
  return chrome.runtime.sendMessage({ type: "updateQueuedApplication", id, patch });
}

async function confirmAndSync(id) {
  return chrome.runtime.sendMessage({ type: "confirmAndSync", id });
}

function renderLastCaptured(app) {
  const el = $("lastCaptured");
  if (!app) {
    el.classList.add("muted");
    el.textContent = "None yet.";
    return;
  }
  el.classList.remove("muted");
  el.innerHTML = `
    <div><strong>${escapeHtml(app.jobTitle || "(No title)")}</strong></div>
    <div class="muted">${escapeHtml(app.companyName || "(No company)")}</div>
    <div class="muted">${escapeHtml(app.jobUrl || "")}</div>
    <div class="muted">${escapeHtml(new Date(app.capturedAt).toLocaleString())}</div>
  `;
}

function queueItemMarkup(item) {
  const title = escapeHtml(item.jobTitle || "(No title)");
  const company = escapeHtml(item.companyName || "(No company)");
  const url = escapeHtml(item.jobUrl || "");
  const resume = escapeHtml(item.resumeFileName || "");
  const captured = escapeHtml(new Date(item.capturedAt).toLocaleString());
  const status = escapeHtml(item.status || "queued");

  return `
    <div class="queueItem" data-id="${escapeHtml(item.id)}">
      <div class="queueTop">
        <div>
          <div><strong>${title}</strong></div>
          <div class="muted">${company}</div>
        </div>
        <div class="pill">${status}</div>
      </div>
      <div class="muted" style="margin-top:6px; word-break: break-word">${url}</div>
      ${resume ? `<div class="muted" style="margin-top:6px">Resume: ${resume}</div>` : ""}
      <div class="muted" style="margin-top:6px">${captured}</div>
      <div class="queueActions">
        <button class="miniBtn" data-action="edit" type="button">Edit</button>
        ${
          item.status === "pending_confirmation"
            ? `<button class="miniBtn primary" data-action="confirm" type="button">Confirm & Sync</button>`
            : `<button class="miniBtn primary" data-action="sync" type="button">Sync</button>`
        }
      </div>
    </div>
  `;
}

function renderQueue(queue) {
  const el = $("queueList");
  if (!queue || queue.length === 0) {
    el.classList.add("muted");
    el.textContent = "No queued items.";
    return;
  }
  el.classList.remove("muted");
  el.innerHTML = queue.map(queueItemMarkup).join("");
}

async function refresh() {
  const state = await getState();
  $("enabledToggle").checked = state.enabled !== false;
  $("todaysCount").textContent = String(state.todaysCount || 0);
  $("sessionCount").textContent = String(state.sessionCount || 0);
  $("confirmToggle").checked = Boolean(state.confirmBeforeSave);

  renderLastCaptured(state.lastCaptured);
  renderQueue(state.queue);

  const settings = state.settings || {};
  $("dashboardUrl").value = settings.dashboardUrl || "";
}

function openDashboard(url) {
  if (!url) return;
  chrome.tabs.create({ url });
  window.close();
}

function installEvents() {
  $("enabledToggle").addEventListener("change", async (e) => {
    await setEnabled(e.target.checked);
    await refresh();
  });

  $("confirmToggle").addEventListener("change", async (e) => {
    await setConfirmBeforeSave(e.target.checked);
    await refresh();
  });

  $("dashboardBtn").addEventListener("click", async () => {
    const state = await getState();
    if (state.settings?.dashboardUrl) openDashboard(state.settings.dashboardUrl);
    else {
      $("settingsStatus").classList.remove("muted");
      $("settingsStatus").textContent = "Set Dashboard URL in Settings.";
    }
  });

  $("syncBtn").addEventListener("click", async () => {
    $("syncBtn").disabled = true;
    try {
      await flushQueue();
    } finally {
      $("syncBtn").disabled = false;
    }
    await refresh();
  });

  $("saveSettingsBtn").addEventListener("click", async () => {
    const settings = {
      dashboardUrl: $("dashboardUrl").value.trim()
    };
    $("saveSettingsBtn").disabled = true;
    $("settingsStatus").classList.remove("muted");
    $("settingsStatus").textContent = "Saving…";
    try {
      await saveSettings(settings);
      $("settingsStatus").textContent = "Saved.";
    } catch (e) {
      $("settingsStatus").textContent = `Save failed: ${String(e?.message || e)}`;
    } finally {
      $("saveSettingsBtn").disabled = false;
    }
    await refresh();
  });

  $("queueList").addEventListener("click", async (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const action = btn.getAttribute("data-action");
    const itemEl = btn.closest(".queueItem");
    if (!itemEl) return;
    const id = itemEl.getAttribute("data-id");
    if (!id) return;

    if (action === "sync") {
      btn.disabled = true;
      try {
        await flushQueue();
      } finally {
        btn.disabled = false;
      }
      await refresh();
      return;
    }

    if (action === "confirm") {
      btn.disabled = true;
      try {
        await confirmAndSync(id);
      } finally {
        btn.disabled = false;
      }
      await refresh();
      return;
    }

    if (action === "edit") {
      const title = prompt("Job title");
      if (title === null) return;
      const company = prompt("Company name");
      if (company === null) return;
      const url = prompt("Job URL");
      if (url === null) return;
      const resume = prompt("Resume filename (optional)") || "";

      await updateQueuedApplication(id, {
        jobTitle: title.trim(),
        companyName: company.trim(),
        jobUrl: url.trim(),
        resumeFileName: resume.trim()
      });
      await refresh();
    }
  });
}

installEvents();
void refresh();
