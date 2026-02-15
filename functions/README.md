# Driftr URL Auto-fill (Firebase Function)

This folder contains an HTTPS Firebase Cloud Function that fetches a job posting URL and extracts basic details (title, company, location) using JSON-LD and Open Graph metadata.

## Deploy

Prereqs:
- Firebase CLI installed (`npm i -g firebase-tools`)
- You’re logged in (`firebase login`)
- Your Firebase project is created and has Firestore + Auth enabled

From the repo root:

1) Connect the repo to your Firebase project:
- `firebase init functions`
  - Choose **JavaScript**
  - Use existing `functions/` directory when prompted
  - Pick Node.js **18**

2) Install function dependencies:
- `cd functions && npm install`

3) Deploy the parser endpoint:
- `firebase deploy --only functions:parseJobUrl`

## Configure the frontend

After deploy, set the React env var to your function URL:

- `REACT_APP_JOB_URL_PARSER_ENDPOINT=https://us-central1-<YOUR_PROJECT_ID>.cloudfunctions.net/parseJobUrl`

Restart `npm start` after updating `.env`.

## CORS

By default (MVP), CORS allows all origins.

To restrict it, set `ALLOWED_ORIGINS` (comma-separated) in your functions environment and redeploy. How you set env vars depends on your Firebase Functions version/workflow; if you don’t already have a convention, simplest is to keep it open for MVP and tighten later.

## Rate limiting

The function has a simple in-memory limit of 20 requests per minute per user (Firebase Auth UID) or per IP if not authenticated.

