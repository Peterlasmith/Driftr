const cors = require("cors");
const cheerio = require("cheerio");
const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

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

function pickFirst(...values) {
  for (const v of values) {
    const t = normalizeText(v);
    if (t) return t;
  }
  return "";
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJobPostingFromJsonLd(json) {
  const candidates = Array.isArray(json) ? json : [json];
  for (const item of candidates) {
    if (!item || typeof item !== "object") continue;
    if (Array.isArray(item["@graph"])) {
      const fromGraph = extractJobPostingFromJsonLd(item["@graph"]);
      if (fromGraph) return fromGraph;
    }
    const type = item["@type"];
    if (type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) return item;
  }
  return null;
}

function formatLocation(address) {
  if (!address || typeof address !== "object") return "";
  const city = pickFirst(address.addressLocality, address.city);
  const region = pickFirst(address.addressRegion, address.state);
  if (city && region) return `${city}, ${region}`;
  return pickFirst(city, region, address.addressCountry);
}

function parseHtmlForJobDetails(html, finalUrl) {
  const $ = cheerio.load(html);

  const meta = (name) =>
    pickFirst($(`meta[property="${name}"]`).attr("content"), $(`meta[name="${name}"]`).attr("content"));

  const pageTitle = pickFirst(meta("og:title"), meta("twitter:title"), $("title").text());
  const h1 = pickFirst($("h1").first().text());
  const effectiveTitle = pickFirst(h1, pageTitle);

  let jobPosting = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (jobPosting) return;
    const raw = $(el).text();
    const parsed = safeJsonParse(raw);
    if (!parsed) return;
    const found = extractJobPostingFromJsonLd(parsed);
    if (found) jobPosting = found;
  });

  const jobTitle = pickFirst(jobPosting?.title, effectiveTitle);
  const company = pickFirst(
    jobPosting?.hiringOrganization?.name,
    meta("og:site_name"),
    normalizeText(effectiveTitle.split(" - ").slice(-1)[0])
  );

  let location = "";
  const loc = jobPosting?.jobLocation;
  if (Array.isArray(loc) && loc[0]?.address) location = formatLocation(loc[0].address);
  else if (loc?.address) location = formatLocation(loc.address);

  const source = (() => {
    try {
      const u = new URL(finalUrl);
      const host = u.hostname.toLowerCase();
      if (host.includes("linkedin.com")) return "LinkedIn";
      if (host.includes("indeed.com")) return "Indeed";
      if (host.endsWith("greenhouse.io")) return "Greenhouse";
      if (host.endsWith("lever.co")) return "Lever";
      return "Generic";
    } catch {
      return "Generic";
    }
  })();

  return {
    jobTitle,
    company,
    location,
    source
  };
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

