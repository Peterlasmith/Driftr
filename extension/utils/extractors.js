function textFrom(el) {
  if (!el) return "";
  return (el.textContent || "").trim();
}

function firstMatch(selectors, root) {
  for (const sel of selectors) {
    const el = root.querySelector(sel);
    if (el) return el;
  }
  return null;
}

function metaContent(name, doc) {
  const d = doc || document;
  const el = d.querySelector(`meta[property="${name}"]`) || d.querySelector(`meta[name="${name}"]`);
  return (el && el.getAttribute("content")) || "";
}

export function detectSource(url) {
  const u = String(url || "");
  if (u.includes("linkedin.com/jobs")) return "linkedin";
  if (u.includes("indeed.")) return "indeed";
  if (u.includes(".greenhouse.io")) return "greenhouse";
  if (u.includes(".lever.co")) return "lever";
  if (u.includes(".myworkdayjobs.com")) return "workday";
  return "unknown";
}

function extractLinkedIn(doc) {
  const titleEl = doc.querySelector("h1");
  const companyEl = firstMatch(
    [
      ".job-details-jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name",
      ".jobs-unified-top-card__company-name a"
    ],
    doc
  );
  return {
    jobTitle: textFrom(titleEl),
    companyName: textFrom(companyEl)
  };
}

function extractIndeed(doc) {
  const titleEl = firstMatch([".jobsearch-JobInfoHeader-title", "h1"], doc);
  const companyEl = firstMatch(["[data-company-name]", ".jobsearch-InlineCompanyRating div:first-child"], doc);
  let companyName = "";
  if (companyEl) {
    companyName = companyEl.getAttribute("data-company-name") || textFrom(companyEl);
  }
  return {
    jobTitle: textFrom(titleEl),
    companyName: companyName.trim()
  };
}

function extractGreenhouse(doc) {
  const titleEl = firstMatch([".app-title", "h1"], doc);
  const companyEl = firstMatch([".company-name", "meta[property='og:site_name']"], doc);
  return {
    jobTitle: textFrom(titleEl),
    companyName: textFrom(companyEl) || metaContent("og:site_name", doc)
  };
}

function extractLever(doc) {
  const titleEl = firstMatch([".app-title", "h1"], doc);
  const companyEl = firstMatch(
    [".company-name", ".posting-header .posting-headline .posting-company", "meta[property='og:site_name']"],
    doc
  );
  return {
    jobTitle: textFrom(titleEl),
    companyName: textFrom(companyEl) || metaContent("og:site_name", doc)
  };
}

function extractWorkday(doc) {
  const titleEl = firstMatch(["h1", "[data-automation-id='jobPostingHeader'] h1"], doc);
  const companyEl = firstMatch(
    ["[data-automation-id='companyName']", "[data-automation-id='jobPostingCompanyName']", "header [aria-label*='Company']"],
    doc
  );
  return {
    jobTitle: textFrom(titleEl) || metaContent("og:title", doc),
    companyName: textFrom(companyEl) || metaContent("og:site_name", doc)
  };
}

function fallbackExtract(doc) {
  const ogTitle = metaContent("og:title", doc);
  const title = ogTitle || textFrom(doc.querySelector("h1"));
  return { jobTitle: title, companyName: metaContent("og:site_name", doc) };
}

export function extract(url, doc) {
  const source = detectSource(url);
  const d = doc || document;
  let out = null;
  if (source === "linkedin") out = extractLinkedIn(d);
  else if (source === "indeed") out = extractIndeed(d);
  else if (source === "greenhouse") out = extractGreenhouse(d);
  else if (source === "lever") out = extractLever(d);
  else if (source === "workday") out = extractWorkday(d);
  else out = fallbackExtract(d);

  if (!out.jobTitle || !out.companyName) {
    const fb = fallbackExtract(d);
    out.jobTitle = out.jobTitle || fb.jobTitle;
    out.companyName = out.companyName || fb.companyName;
  }
  return out;
}
