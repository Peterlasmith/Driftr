import React, { useEffect, useMemo, useState } from "react";
import styles from "./ApplicationCsvImportModal.module.css";
import {
  createApplicationsBulk,
  findDuplicateKeys,
  validateAndNormalizeImportRow
} from "../services/applications";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const PREVIEW_LIMIT = 8;

const FIELD_DEFS = [
  { key: "jobTitle", label: "Job Title", required: true },
  { key: "company", label: "Company", required: true },
  { key: "location", label: "Location", required: false },
  { key: "jobUrl", label: "Job URL", required: false },
  { key: "dateApplied", label: "Date Applied", required: true },
  { key: "stage", label: "Stage", required: false },
  { key: "resume", label: "Resume", required: false },
  { key: "notes", label: "Notes", required: false }
];

const HEADER_ALIASES = {
  jobTitle: ["job title", "title", "position", "role"],
  company: ["company", "employer", "organization"],
  location: ["location", "city", "state", "office"],
  jobUrl: ["job url", "url", "posting url", "application url", "link"],
  dateApplied: ["date applied", "applied", "application date", "date"],
  stage: ["stage", "status"],
  resume: ["resume", "resume version", "cv", "resume name"],
  notes: ["notes", "note", "comments", "comment"]
};

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function makeUniqueHeaders(headers) {
  const counts = new Map();
  return headers.map((header, idx) => {
    const base = String(header || "").trim() || `Column ${idx + 1}`;
    const seen = counts.get(base) || 0;
    counts.set(base, seen + 1);
    if (seen === 0) return base;
    return `${base} (${seen + 1})`;
  });
}

function parseCsvText(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        const next = text[i + 1];
        if (next === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }

    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }

    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    if (ch === "\r") {
      continue;
    }

    cell += ch;
  }

  row.push(cell);
  rows.push(row);

  const trimmedRows = rows
    .map((r) => r.map((v) => String(v || "").trim()))
    .filter((r) => r.some((v) => v !== ""));

  if (trimmedRows.length < 2) {
    return { ok: false, error: "CSV needs a header row and at least one data row." };
  }

  const headers = makeUniqueHeaders(trimmedRows[0]);
  const dataRows = trimmedRows.slice(1).map((r, idx) => {
    const obj = {};
    headers.forEach((h, hIdx) => {
      obj[h] = String(r[hIdx] || "").trim();
    });
    return { rowNumber: idx + 2, data: obj };
  });

  return { ok: true, headers, rows: dataRows };
}

function suggestMapping(headers) {
  const normalizedHeaders = headers.map((h) => ({ raw: h, normalized: normalizeHeader(h) }));
  const mapping = {};

  FIELD_DEFS.forEach((field) => {
    const aliases = HEADER_ALIASES[field.key] || [];
    const found = normalizedHeaders.find((h) => aliases.includes(h.normalized));
    mapping[field.key] = found?.raw || "";
  });

  return mapping;
}

function buildResumeMap(resumes) {
  const map = new Map();
  (resumes || []).forEach((resume) => {
    const key = String(resume?.versionName || "")
      .trim()
      .toLowerCase();
    if (!key) return;
    if (!map.has(key)) map.set(key, resume);
  });
  return map;
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (!str.includes('"') && !str.includes(",") && !str.includes("\n")) return str;
  return `"${str.replace(/"/g, '""')}"`;
}

function buildReportCsv(rows) {
  const lines = ["Row,Outcome,Details"];
  rows.forEach((row) => {
    const details = row.messages.join(" | ");
    lines.push([row.rowNumber, row.outcome, details].map(csvEscape).join(","));
  });
  return `${lines.join("\n")}\n`;
}

export default function ApplicationCsvImportModal({
  open,
  userId,
  resumes,
  onClose,
  onImported
}) {
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [analysis, setAnalysis] = useState(null);
  const [resultSummary, setResultSummary] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const resumeByName = useMemo(() => buildResumeMap(resumes), [resumes]);

  useEffect(() => {
    if (!open) {
      setFileName("");
      setHeaders([]);
      setRows([]);
      setMapping({});
      setAnalysis(null);
      setResultSummary(null);
      setError("");
      setBusy(false);
      setCopied(false);
    }
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1400);
    return () => clearTimeout(t);
  }, [copied]);

  if (!open) return null;

  function updateMapping(fieldKey, header) {
    setMapping((prev) => ({ ...prev, [fieldKey]: header }));
    setAnalysis(null);
    setResultSummary(null);
    setError("");
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    setAnalysis(null);
    setResultSummary(null);
    setError("");

    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setError("CSV is too large for v1 import (max 2MB).");
      return;
    }

    try {
      const text = await file.text();
      const parsed = parseCsvText(text);
      if (!parsed.ok) {
        setError(parsed.error || "Could not parse CSV.");
        return;
      }

      setFileName(file.name);
      setHeaders(parsed.headers);
      setRows(parsed.rows);
      setMapping(suggestMapping(parsed.headers));
    } catch (err) {
      setError(err?.message || "Failed to read CSV file.");
    }
  }

  function hasRequiredMappings() {
    return FIELD_DEFS.filter((f) => f.required).every((f) => mapping[f.key]);
  }

  async function handleReview() {
    if (!userId) {
      setError("You must be signed in to import.");
      return;
    }
    if (!rows.length) {
      setError("Choose a CSV file first.");
      return;
    }
    if (!hasRequiredMappings()) {
      setError("Map all required fields before reviewing import.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const existingKeys = await findDuplicateKeys(userId);
      const duplicateKeys = new Set(existingKeys);

      const analyzedRows = rows.map((row) => {
        const normalized = validateAndNormalizeImportRow(row.data, mapping, {
          resumeByName,
          duplicateKeys
        });

        return {
          rowNumber: row.rowNumber,
          ok: normalized.ok,
          duplicate: normalized.duplicate,
          errors: normalized.errors,
          warnings: normalized.warnings,
          input: normalized.input
        };
      });

      const validRows = analyzedRows.filter((r) => r.ok).map((r) => ({
        rowNumber: r.rowNumber,
        input: r.input
      }));

      const summary = {
        valid: analyzedRows.filter((r) => r.ok).length,
        warning: analyzedRows.filter((r) => r.warnings.length > 0).length,
        invalid: analyzedRows.filter((r) => r.errors.length > 0).length,
        duplicates: analyzedRows.filter((r) => r.duplicate).length,
        rows: analyzedRows,
        validRows
      };

      setAnalysis(summary);
    } catch (err) {
      setError(err?.message || "Failed to prepare import.");
    }

    setBusy(false);
  }

  async function handleImport() {
    if (!analysis || !analysis.validRows.length || !userId) return;

    setBusy(true);
    setError("");

    try {
      const writes = await createApplicationsBulk(userId, analysis.validRows);
      const failures = new Map(
        writes
          .filter((w) => !w.ok)
          .map((w) => [w.rowNumber, w.error || "Failed to import row."])
      );

      const reportRows = analysis.rows.map((row) => {
        if (row.errors.length > 0) {
          return {
            rowNumber: row.rowNumber,
            outcome: "Skipped: invalid",
            messages: row.errors
          };
        }

        if (row.duplicate) {
          return {
            rowNumber: row.rowNumber,
            outcome: "Skipped: duplicate",
            messages: row.warnings
          };
        }

        const failure = failures.get(row.rowNumber);
        if (failure) {
          return {
            rowNumber: row.rowNumber,
            outcome: "Failed import",
            messages: [failure]
          };
        }

        const successMessages = row.warnings.length ? row.warnings : ["Imported"];
        return {
          rowNumber: row.rowNumber,
          outcome: "Imported",
          messages: successMessages
        };
      });

      const created = writes.filter((w) => w.ok).length;
      const failed = writes.filter((w) => !w.ok).length;

      setResultSummary({
        created,
        duplicates: analysis.duplicates,
        invalid: analysis.invalid,
        failed,
        reportRows
      });

      if (onImported) onImported(created);
    } catch (err) {
      setError(err?.message || "Import failed.");
    }

    setBusy(false);
  }

  async function handleCopyReport() {
    if (!resultSummary?.reportRows?.length) return;
    const text = buildReportCsv(resultSummary.reportRows);

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch (err) {
      setError("Clipboard unavailable. Use Download report instead.");
    }
  }

  function handleDownloadReport() {
    if (!resultSummary?.reportRows?.length) return;
    const text = buildReportCsv(resultSummary.reportRows);
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "driftr-import-report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const reviewRows = (analysis?.rows || []).slice(0, PREVIEW_LIMIT);

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Import CSV">
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <div className={styles.title}>Import Applications CSV</div>
            <div className={styles.subtle}>Map CSV columns to existing Driftr fields</div>
          </div>
          <button className={styles.iconButton} onClick={onClose} disabled={busy} aria-label="Close">
            ✕
          </button>
        </div>

        <div className={styles.body}>
          <label className={styles.field}>
            <div className={styles.label}>CSV file</div>
            <input
              className={styles.input}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              disabled={busy}
            />
            <div className={styles.hint}>Max 2MB for v1. Header row is required.</div>
            {fileName ? <div className={styles.hint}>Loaded: {fileName}</div> : null}
          </label>

          {headers.length ? (
            <div className={styles.mappingWrap}>
              <div className={styles.sectionTitle}>Field mapping</div>
              <div className={styles.mapGrid}>
                {FIELD_DEFS.map((field) => (
                  <label key={field.key} className={styles.field}>
                    <div className={styles.label}>
                      {field.label}
                      {field.required ? <span className={styles.required}> *</span> : null}
                    </div>
                    <select
                      className={styles.input}
                      value={mapping[field.key] || ""}
                      onChange={(e) => updateMapping(field.key, e.target.value)}
                      disabled={busy}
                    >
                      <option value="">(Do not map)</option>
                      {headers.map((header) => (
                        <option key={`${field.key}-${header}`} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>
              <div className={styles.hint}>Required fields must be mapped: Job Title, Company, Date Applied.</div>
            </div>
          ) : null}

          {analysis ? (
            <div className={styles.previewWrap}>
              <div className={styles.sectionTitle}>Preview</div>
              <div className={styles.metrics}>
                <span className={styles.metric}>Valid: {analysis.valid}</span>
                <span className={styles.metric}>Warnings: {analysis.warning}</span>
                <span className={styles.metric}>Invalid: {analysis.invalid}</span>
                <span className={styles.metric}>Duplicates: {analysis.duplicates}</span>
              </div>

              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Result</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reviewRows.map((row) => {
                      const details = [...row.errors, ...row.warnings].join(" | ") || "Looks good";
                      const result = row.errors.length
                        ? "Invalid"
                        : row.duplicate
                          ? "Duplicate"
                          : row.warnings.length
                            ? "Valid with warning"
                            : "Valid";

                      return (
                        <tr key={`row-${row.rowNumber}`}>
                          <td>{row.rowNumber}</td>
                          <td>{result}</td>
                          <td>{details}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {analysis.rows.length > PREVIEW_LIMIT ? (
                <div className={styles.hint}>Preview shows first {PREVIEW_LIMIT} rows.</div>
              ) : null}
            </div>
          ) : null}

          {resultSummary ? (
            <div className={styles.resultWrap}>
              <div className={styles.sectionTitle}>Import complete</div>
              <div className={styles.metrics}>
                <span className={styles.metric}>Created: {resultSummary.created}</span>
                <span className={styles.metric}>Skipped duplicates: {resultSummary.duplicates}</span>
                <span className={styles.metric}>Skipped invalid: {resultSummary.invalid}</span>
                <span className={styles.metric}>Write failures: {resultSummary.failed}</span>
              </div>
              <div className={styles.rowButtons}>
                <button type="button" className={styles.secondaryButton} onClick={handleCopyReport}>
                  {copied ? "Copied" : "Copy report"}
                </button>
                <button type="button" className={styles.secondaryButton} onClick={handleDownloadReport}>
                  Download report
                </button>
              </div>
            </div>
          ) : null}

          {error ? <div className={styles.error}>{error}</div> : null}
        </div>

        <div className={styles.footer}>
          <button type="button" className={styles.secondaryButton} onClick={onClose} disabled={busy}>
            Close
          </button>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={handleReview}
            disabled={busy || !rows.length}
          >
            {busy ? "Working…" : "Review import"}
          </button>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={handleImport}
            disabled={busy || !analysis?.validRows?.length}
          >
            {busy ? "Working…" : "Import valid rows"}
          </button>
        </div>
      </div>
    </div>
  );
}
