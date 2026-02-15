const cheerio = require("cheerio");

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
  const raw = String(text || "").trim();
  if (!raw) return null;

  const candidates = [];
  candidates.push(raw);
  candidates.push(raw.replace(/^\s*<!--/, "").replace(/-->\s*$/, "").trim());
  candidates.push(raw.replace(/;\s*$/, "").trim());
  candidates.push(raw.replace(/^\s*<!--/, "").replace(/-->\s*$/, "").replace(/;\s*$/, "").trim());

  for (const c of candidates) {
    if (!c) continue;
    try {
      return JSON.parse(c);
    } catch {
      // keep trying
    }
  }
  return null;
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

function extractLinkedInCompanyFromDom($) {
  const selectors = [
    ".job-details-jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name",
    ".jobs-unified-top-card__company-name a",
    ".job-details-jobs-unified-top-card__company-name a",
    'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
    "a.topcard__org-name-link",
    ".topcard__org-name-link",
    ".topcard__flavor a"
  ];

  for (const sel of selectors) {
    const text = normalizeText($(sel).first().text());
    if (text) return text;
  }
  return "";
}

function extractLinkedInLocationFromDom($) {
  const selectors = [
    ".job-details-jobs-unified-top-card__primary-description-container",
    ".jobs-unified-top-card__primary-description",
    ".jobs-unified-top-card__bullet",
    ".topcard__flavor--bullet",
    ".topcard__flavor--bullet + span",
    ".topcard__flavor--metadata",
    ".topcard__flavor--bullet"
  ];

  for (const sel of selectors) {
    const text = normalizeText($(sel).first().text());
    if (!text) continue;
    // Some containers include "Company · Location · ..." — keep the most location-like chunk.
    const chunks = text
      .split("·")
      .map((c) => normalizeText(c))
      .filter(Boolean);
    const best = chunks.find((c) => /,/.test(c)) || chunks[chunks.length - 1];
    if (best) return best;
  }
  return "";
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

  const isLinkedIn = (() => {
    try {
      return new URL(finalUrl).hostname.toLowerCase().includes("linkedin.com");
    } catch {
      return false;
    }
  })();

  const jobTitle = pickFirst(jobPosting?.title, effectiveTitle);

  const linkedInCompany = isLinkedIn ? extractLinkedInCompanyFromDom($) : "";
  const inferredCompanyFromTitle = normalizeText(effectiveTitle.split(" - ").slice(-1)[0]);

  let company = "";
  if (isLinkedIn) {
    company = pickFirst(jobPosting?.hiringOrganization?.name, linkedInCompany);
  } else {
    company = pickFirst(jobPosting?.hiringOrganization?.name, meta("og:site_name"), inferredCompanyFromTitle);
  }

  if (normalizeText(company) && normalizeText(company) === normalizeText(jobTitle)) {
    company = pickFirst(linkedInCompany, jobPosting?.hiringOrganization?.name);
  }

  let location = "";
  const loc = jobPosting?.jobLocation;
  if (Array.isArray(loc) && loc[0]?.address) location = formatLocation(loc[0].address);
  else if (loc?.address) location = formatLocation(loc.address);

  if (!location && isLinkedIn) {
    location = extractLinkedInLocationFromDom($);
  }

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

module.exports = {
  parseHtmlForJobDetails
};

