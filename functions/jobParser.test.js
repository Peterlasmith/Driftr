const test = require("node:test");
const assert = require("node:assert/strict");

const { parseHtmlForJobDetails } = require("./jobParser");

test("parses JobPosting JSON-LD (LinkedIn-like)", () => {
  const html = `<!doctype html>
  <html>
    <head>
      <title>Senior Backend Engineer - ExampleCo | LinkedIn</title>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "JobPosting",
          "title": "Senior Backend Engineer",
          "hiringOrganization": { "@type": "Organization", "name": "ExampleCo" },
          "jobLocation": [{
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "San Francisco",
              "addressRegion": "CA"
            }
          }]
        }
      </script>
    </head>
    <body>
      <h1>Senior Backend Engineer</h1>
    </body>
  </html>`;

  const out = parseHtmlForJobDetails(html, "https://www.linkedin.com/jobs/view/4366375961");
  assert.equal(out.jobTitle, "Senior Backend Engineer");
  assert.equal(out.company, "ExampleCo");
  assert.equal(out.location, "San Francisco, CA");
});

test("falls back to DOM selectors when JSON-LD missing", () => {
  const html = `<!doctype html>
  <html>
    <head>
      <title>Data Engineer - FallbackCo | LinkedIn</title>
    </head>
    <body>
      <h1>Data Engineer</h1>
      <div class="job-details-jobs-unified-top-card__company-name">FallbackCo</div>
      <div class="jobs-unified-top-card__bullet">New York, NY</div>
    </body>
  </html>`;

  const out = parseHtmlForJobDetails(html, "https://www.linkedin.com/jobs/view/4366375961");
  assert.equal(out.jobTitle, "Data Engineer");
  assert.equal(out.company, "FallbackCo");
  assert.equal(out.location, "New York, NY");
});

