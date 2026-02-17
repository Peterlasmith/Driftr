const cors = require("cors");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { parseHtmlForJobDetails } = require("./jobParser");
const { analyzeResumeWithOpenAI, extractResumeText } = require("./resumeAnalyzer");

admin.initializeApp();

const corsHandler = cors({
  origin: (origin, cb) => {
    const allowed = (process.env.ALLOWED_ORIGINS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!origin) return cb(null, true);
    if (allowed.length === 0) return cb(null, true); // MVP default: allow all
    if (allowed.includes(origin)) return cb(null, true);
    return cb(new Error("CORS blocked"));
  },
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
});

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
const rateBuckets = new Map();

function now() {
  return Date.now();
}

function rateKey({ uid, ip }) {
  if (uid) return `uid:${uid}`;
  if (ip) return `ip:${ip}`;
  return "anon";
}

function checkRateLimit(key) {
  const t = now();
  const bucket = rateBuckets.get(key) || { start: t, count: 0 };
  if (t - bucket.start > RATE_LIMIT_WINDOW_MS) {
    bucket.start = t;
    bucket.count = 0;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  return bucket.count <= RATE_LIMIT_MAX;
}

function isBlockedHostname(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".local")) return true;
  if (h === "127.0.0.1" || h === "0.0.0.0" || h === "::1") return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(h)) return true;
  return false;
}

function normalizeText(s) {
  return String(s || "")
    .replace(/\s+/g, " ")
    .trim();
}

async function downloadStorageFile(path) {
  const clean = String(path || "").trim().replace(/^\/+/, "");
  if (!clean) throw new Error("Missing storage path");
  const bucket = admin.storage().bucket();
  const file = bucket.file(clean);
  const [buf] = await file.download();
  return Buffer.from(buf);
}

async function verifyFirebaseIdToken(authHeader) {
  const header = String(authHeader || "");
  const m = header.match(/^Bearer (.+)$/i);
  if (!m) return null;
  try {
    const decoded = await admin.auth().verifyIdToken(m[1]);
    return decoded?.uid || null;
  } catch {
    return null;
  }
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; DriftrJobParser/1.0; +https://example.invalid) AppleWebKit/537.36",
        accept: "text/html,application/xhtml+xml"
      }
    });

    const contentType = String(res.headers.get("content-type") || "");
    const finalUrl = res.url || url;
    const text = await res.text();
    return { ok: res.ok, status: res.status, contentType, finalUrl, text };
  } finally {
    clearTimeout(timeout);
  }
}

exports.parseJobUrl = onRequest({ region: "us-central1" }, async (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const uid = await verifyFirebaseIdToken(req.get("authorization"));
    const ip =
      (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "";

    const key = rateKey({ uid, ip });
    if (!checkRateLimit(key)) return res.status(429).json({ error: "Rate limited" });

    const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
    if (!url) return res.status(400).json({ error: "Missing url" });

    let u;
    try {
      u = new URL(url);
    } catch {
      return res.status(400).json({ error: "Invalid url" });
    }
    if (u.protocol !== "http:" && u.protocol !== "https:")
      return res.status(400).json({ error: "Invalid url protocol" });
    if (isBlockedHostname(u.hostname)) return res.status(400).json({ error: "Blocked host" });

    try {
      const fetched = await fetchHtml(u.toString());
      if (!fetched.ok) {
        return res.status(200).json({
          ok: false,
          error: `Fetch failed (${fetched.status})`
        });
      }
      if (!fetched.contentType.includes("text/html")) {
        return res.status(200).json({
          ok: false,
          error: "URL did not return HTML"
        });
      }

      const details = parseHtmlForJobDetails(fetched.text, fetched.finalUrl);
      const payload = {
        ok: Boolean(details.jobTitle || details.company),
        url: fetched.finalUrl,
        ...details
      };
      return res.status(200).json(payload);
    } catch (err) {
      return res.status(200).json({
        ok: false,
        error: "Parse failed"
      });
    }
  });
});

exports.analyzeResume = onRequest({ region: "us-central1", timeoutSeconds: 60 }, async (req, res) => {
  corsHandler(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const uid = await verifyFirebaseIdToken(req.get("authorization"));
    const ip =
      (req.headers["x-forwarded-for"] || "").toString().split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "";
    const key = rateKey({ uid, ip });
    if (!checkRateLimit(key)) return res.status(429).json({ error: "Rate limited" });
    if (!uid) return res.status(401).json({ error: "Unauthorized" });

    const resumeId = typeof req.body?.resumeId === "string" ? req.body.resumeId.trim() : "";
    if (!resumeId) return res.status(400).json({ error: "Missing resumeId" });

    try {
      const resumeRef = admin.firestore().collection("resumes").doc(resumeId);
      const snap = await resumeRef.get();
      if (!snap.exists) return res.status(404).json({ error: "Resume not found" });
      const data = snap.data() || {};
      if (data.userId !== uid) return res.status(403).json({ error: "Forbidden" });

      if (data.analysisResult && data.analyzedAt) {
        return res.status(200).json({
          ok: true,
          cached: true,
          analysisResult: data.analysisResult,
          analyzedAt: data.analyzedAt
        });
      }

      const storagePath = String(data.storagePath || "").trim();
      if (!storagePath) return res.status(400).json({ error: "Resume file missing" });

      const buffer = await downloadStorageFile(storagePath);
      const text = await extractResumeText({
        buffer,
        fileType: data.fileType,
        fileName: data.fileName
      });
      if (!text) return res.status(200).json({ ok: false, error: "No text found in resume" });

      const analysisResult = await analyzeResumeWithOpenAI({ resumeText: text });
      await resumeRef.update({
        analysisResult,
        analyzedAt: admin.firestore.FieldValue.serverTimestamp(),
        feedback: null,
        feedbackAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return res.status(200).json({ ok: true, cached: false, analysisResult });
    } catch (err) {
      const msg = String(err?.message || "");
      const isExtraction =
        msg.toLowerCase().includes("unsupported file type") ||
        msg.toLowerCase().includes("invalid pdf") ||
        msg.toLowerCase().includes("corrupt");
      const isAuth = msg.toLowerCase().includes("missing openai_api_key");
      return res.status(200).json({
        ok: false,
        error: isAuth
          ? "Resume analysis is not configured."
          : isExtraction
            ? "Couldn’t extract text from this file. Try re-exporting the PDF/DOCX and uploading again."
            : "Resume analysis failed. Please try again."
      });
    }
  });
});
