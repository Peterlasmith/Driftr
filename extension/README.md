# Driftr Job Application Capture (Chrome Extension)

Captures job application events from common job boards and syncs them to Firebase Firestore.

## Features
- ON/OFF toggle (no tracking when OFF)
- Captured count (today) + badge count (this session)
- Extracts job title, company name, URL, timestamp, and resume filename (when detectable)
- Offline-friendly queue (syncs opportunistically; manual "Sync Now" in popup)
- Optional confirmation flow (“Ask before saving”) with edit-before-sync in the popup
- Visual indicator on supported sites when tracking is ON (“Tracking ON” pill)

## Install (Load Unpacked)
### 1) Bundle Firebase for Chrome extensions (required)
Chrome extensions cannot load Firebase from a CDN at runtime. The Firebase v9+ modular SDK must be bundled into the extension as a local file.

From the repo root:
1. Install deps: `npm install`
2. Bundle Firebase into the extension: `npm run build:extension`

This generates `extension/vendor/firebase.js` (and a sourcemap) from `extension/vendor/firebase.entry.js`.

### 2) Load unpacked
1. Open Chrome → `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the folder: `extension/`

## Firestore collection + document shape
The extension writes one document per capture to the Firestore collection named `applications`.

Document shape:
- `jobTitle` (string)
- `company` (string)
- `jobUrl` (string)
- `dateApplied` (timestamp) — stored as `new Date()` in the client
- `status` (string) — `"Applied"`
- `resumeVersion` (string, optional)
- `notes` (string, optional)

## Firestore Security Rules note
The Firebase web config in `extension/config/firebase.js` is not a secret. Your Firestore Security Rules must still enforce who can write to `applications` (and/or you should add Firebase Auth and write as the signed-in user).

## Testing Guide (per job board)
General approach:
1. Turn extension **ON**
2. Navigate to a job posting
3. Click **Apply** (if present), then proceed to the final submission step
4. Click **Submit** / **Submit application** / **Finish**
5. Open the popup and confirm:
   - “Last captured” updates
- Queue updates (if offline or confirmation enabled)
   - “Sync Now” sends to Firestore

### LinkedIn Jobs
- URL pattern: `linkedin.com/jobs/*`
- Expected selectors: title from `h1`, company from `.job-details-jobs-unified-top-card__company-name`
- Notes: LinkedIn is a SPA; URL-change fallback helps capture.

### Indeed
- URL pattern: `indeed.com/*` (including locale subdomains)
- Expected selectors: title `.jobsearch-JobInfoHeader-title`, company `[data-company-name]`

### Greenhouse
- URL pattern: `*.greenhouse.io/*`
- Expected selectors: title `.app-title`, company `.company-name`

### Lever
- URL pattern: `*.lever.co/*`
- Expected selectors: title `.app-title`, company `.company-name`

### Workday
- URL pattern: `*.myworkdayjobs.com/*`
- Expected selectors: title `h1`, company from common Workday automation ids when present

## Add a new job board
1. Add the domain pattern to `host_permissions` and `content_scripts.matches` in `extension/manifest.json`.
2. Add detection to `detectSource()` in `extension/utils/extractors.js`.
3. Add an `extract<Board>()` function and wire it in `extract()`.
4. Optionally refine click/submit detection in `extension/content.js` if the board uses custom controls.

## Notes / Limitations
- This is intentionally minimal: it prioritizes accuracy for the 4 core fields (title, company, URL, timestamp).
- Some sites block or heavily virtualize DOM content; in those cases, extraction may fall back to `og:title` / `og:site_name`.
- Resume filename capture depends on the page using a standard `input[type=file]`.
