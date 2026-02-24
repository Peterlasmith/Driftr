import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "../config/firebase";
import { extractRejectionInsights } from "./rejectionFeedbackInsights";

const COLLECTION_NAME = "applications";
export const APPLICATION_STATUS_OPTIONS = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Rejected"
];
export const REJECTION_REASON_OPTIONS = [
  "NO_RESPONSE",
  "SCREEN_REJECT",
  "INTERVIEW_REJECT",
  "ROLE_CLOSED",
  "SALARY_MISMATCH",
  "SKILL_MISMATCH",
  "CULTURE_FIT",
  "OTHER",
  "UNKNOWN"
];

function toJsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  return null;
}

function toMidnightDate(dateInputValue) {
  if (!dateInputValue) return null;
  const d = new Date(`${dateInputValue}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asCleanString(value) {
  return String(value ?? "").trim();
}

function normalizeDateForInput(rawValue) {
  const raw = asCleanString(rawValue);
  if (!raw) return null;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;

  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toDuplicateKey(jobTitle, company, dateApplied) {
  const title = asCleanString(jobTitle).toLowerCase();
  const org = asCleanString(company).toLowerCase();
  const date = asCleanString(dateApplied);
  if (!title || !org || !date) return "";
  return `${title}||${org}||${date}`;
}

function normalizeStatus(rawValue) {
  const value = asCleanString(rawValue);
  if (!value) return { status: "Applied", warning: "" };
  const match = APPLICATION_STATUS_OPTIONS.find((s) => s.toLowerCase() === value.toLowerCase());
  if (match) return { status: match, warning: "" };
  return {
    status: "Applied",
    warning: `Unknown status "${value}" defaulted to "Applied".`
  };
}

function getMappedValue(rawRow, mapping, fieldName) {
  const header = mapping?.[fieldName];
  if (!header) return "";
  return rawRow?.[header];
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
}

function normalizeRejectionInsights(value) {
  if (!value || typeof value !== "object") return null;
  const processOnly = Boolean(value.processOnly);
  const skillGaps = normalizeStringArray(value.skillGaps);
  const experienceMismatches = normalizeStringArray(value.experienceMismatches);
  const softSignals = normalizeStringArray(value.softSignals);
  return {
    skillGaps: processOnly ? [] : skillGaps,
    experienceMismatches: processOnly ? [] : experienceMismatches,
    softSignals: processOnly ? [] : softSignals,
    processOnly
  };
}

function triggerRejectionInsightsExtractionSilently(applicationId, note) {
  if (!applicationId) return;
  if (!String(note || "").trim()) return;
  void extractRejectionInsights(applicationId).catch(() => {});
}

function normalizeDoc(id, data) {
  return {
    id,
    userId: data?.userId ?? "",
    jobTitle: data?.jobTitle ?? "",
    company: data?.company ?? "",
    location: data?.location ?? "",
    jobUrl: data?.jobUrl ?? "",
    dateApplied: toJsDate(data?.dateApplied),
    status: data?.status ?? "Applied",
    statusChangedAt: toJsDate(data?.statusChangedAt),
    resumeVersionId: data?.resumeVersionId ?? "",
    resumeVersion: data?.resumeVersion ?? "",
    notes: data?.notes ?? "",
    rejectionReasonTags: Array.isArray(data?.rejectionReasonTags) ? data.rejectionReasonTags : [],
    rejectionReasonNote: data?.rejectionReasonNote ?? "",
    rejectionInsights: normalizeRejectionInsights(data?.rejectionInsights),
    rejectionInsightsExtractedAt: toJsDate(data?.rejectionInsightsExtractedAt),
    rejectionCapturedAt: toJsDate(data?.rejectionCapturedAt),
    rejectionFeedbackPromptDisabledForApp: Boolean(data?.rejectionFeedbackPromptDisabledForApp),
    rejectionFeedbackPromptDisabledAt: toJsDate(data?.rejectionFeedbackPromptDisabledAt),
    archivedAt: toJsDate(data?.archivedAt),
    archivedBy: data?.archivedBy ?? ""
  };
}

export function subscribeToApplications(userId, onData, onError) {
  if (!userId) throw new Error("subscribeToApplications requires userId");
  const q = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
    orderBy("dateApplied", "desc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => normalizeDoc(d.id, d.data()));
      onData(rows);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export function subscribeToArchivedApplications(userId, onData, onError) {
  if (!userId) throw new Error("subscribeToArchivedApplications requires userId");
  const q = query(
    collection(db, COLLECTION_NAME),
    where("userId", "==", userId),
    where("archivedAt", "!=", null),
    orderBy("archivedAt", "desc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => normalizeDoc(d.id, d.data()));
      onData(rows);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function createApplication(userId, input) {
  if (!userId) throw new Error("createApplication requires userId");
  const date = toMidnightDate(input.dateApplied);
  const payload = {
    userId,
    jobTitle: input.jobTitle?.trim() ?? "",
    company: input.company?.trim() ?? "",
    location: input.location?.trim() || null,
    jobUrl: input.jobUrl?.trim() ?? "",
    dateApplied: date ? Timestamp.fromDate(date) : null,
    status: input.status ?? "Applied",
    statusChangedAt: serverTimestamp(),
    resumeVersionId: input.resumeVersionId || null,
    resumeVersion: input.resumeVersion?.trim() || null,
    notes: input.notes?.trim() || null,
    rejectionReasonTags: [],
    rejectionReasonNote: null,
    rejectionInsights: null,
    rejectionInsightsExtractedAt: null,
    rejectionCapturedAt: null,
    rejectionFeedbackPromptDisabledForApp: false,
    rejectionFeedbackPromptDisabledAt: null,
    archivedAt: null,
    archivedBy: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, COLLECTION_NAME), payload);
  return ref.id;
}

export function validateAndNormalizeImportRow(rawRow, mapping, context = {}) {
  const errors = [];
  const warnings = [];

  const jobTitle = asCleanString(getMappedValue(rawRow, mapping, "jobTitle"));
  const company = asCleanString(getMappedValue(rawRow, mapping, "company"));
  const dateApplied = normalizeDateForInput(getMappedValue(rawRow, mapping, "dateApplied"));

  if (!jobTitle) errors.push("Missing required job title.");
  if (!company) errors.push("Missing required company.");
  if (!dateApplied) errors.push("Missing or invalid date applied.");

  const location = asCleanString(getMappedValue(rawRow, mapping, "location"));
  const jobUrl = asCleanString(getMappedValue(rawRow, mapping, "jobUrl"));
  const notes = asCleanString(getMappedValue(rawRow, mapping, "notes"));
  const resumeText = asCleanString(getMappedValue(rawRow, mapping, "resume"));

  const { status, warning: statusWarning } = normalizeStatus(
    getMappedValue(rawRow, mapping, "status")
  );
  if (statusWarning) warnings.push(statusWarning);

  let resumeVersionId = null;
  if (resumeText) {
    const resumeMap = context?.resumeByName || new Map();
    const resume = resumeMap.get(resumeText.toLowerCase());
    if (resume?.id) {
      resumeVersionId = resume.id;
    } else {
      warnings.push(`Resume "${resumeText}" not found; resume left empty.`);
    }
  }

  const duplicateKey = toDuplicateKey(jobTitle, company, dateApplied);
  const duplicateSet = context?.duplicateKeys || new Set();
  let duplicate = false;
  if (!errors.length && duplicateKey && duplicateSet.has(duplicateKey)) {
    duplicate = true;
    warnings.push("Duplicate application skipped.");
  }

  if (!errors.length && duplicateKey) {
    duplicateSet.add(duplicateKey);
  }

  return {
    ok: errors.length === 0 && !duplicate,
    duplicate,
    errors,
    warnings,
    duplicateKey,
    input: {
      jobTitle,
      company,
      location: location || null,
      jobUrl,
      dateApplied,
      status,
      resumeVersionId,
      resumeVersion: null,
      notes: notes || null
    }
  };
}

export async function findDuplicateKeys(userId) {
  if (!userId) throw new Error("findDuplicateKeys requires userId");
  const q = query(collection(db, COLLECTION_NAME), where("userId", "==", userId));
  const snap = await getDocs(q);
  const keys = new Set();
  snap.forEach((d) => {
    const data = d.data();
    const date = toJsDate(data?.dateApplied);
    if (!date) return;
    const yyyy = String(date.getFullYear());
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    const key = toDuplicateKey(data?.jobTitle, data?.company, `${yyyy}-${mm}-${dd}`);
    if (key) keys.add(key);
  });
  return keys;
}

export async function createApplicationsBulk(userId, rows) {
  if (!userId) throw new Error("createApplicationsBulk requires userId");
  const results = [];

  for (const row of rows || []) {
    try {
      const id = await createApplication(userId, row.input);
      results.push({ ok: true, id, rowNumber: row.rowNumber });
    } catch (err) {
      results.push({
        ok: false,
        rowNumber: row.rowNumber,
        error: err?.message || "Failed to create application."
      });
    }
  }

  return results;
}

export async function updateApplication(userId, id, input) {
  if (!userId) throw new Error("updateApplication requires userId");
  const date = toMidnightDate(input.dateApplied);
  const payload = {
    jobTitle: input.jobTitle?.trim() ?? "",
    company: input.company?.trim() ?? "",
    location: input.location?.trim() || null,
    jobUrl: input.jobUrl?.trim() ?? "",
    dateApplied: date ? Timestamp.fromDate(date) : null,
    status: input.status ?? "Applied",
    resumeVersionId: input.resumeVersionId || null,
    resumeVersion: input.resumeVersion?.trim() || null,
    notes: input.notes?.trim() || null,
    updatedAt: serverTimestamp()
  };

  await updateDoc(doc(db, COLLECTION_NAME, id), payload);
}

export async function deleteApplication(userId, id) {
  if (!userId) throw new Error("deleteApplication requires userId");
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

export async function updateApplicationStatus(userId, id, status) {
  if (!userId) throw new Error("updateApplicationStatus requires userId");
  await updateApplicationStatusWithRejectionMeta(userId, id, status);
}

export async function updateApplicationStatusWithRejectionMeta(
  userId,
  id,
  status,
  rejectionMeta = null
) {
  if (!userId) throw new Error("updateApplicationStatusWithRejectionMeta requires userId");
  if (!APPLICATION_STATUS_OPTIONS.includes(status)) throw new Error("Invalid application status.");
  let extractedNoteForTrigger = "";
  let shouldTriggerRejectionInsights = false;

  const payload = {
    status,
    statusChangedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (status === "Rejected") {
    const tags = Array.isArray(rejectionMeta?.tags) ? rejectionMeta.tags : [];
    const validTags = tags.filter((tag) => REJECTION_REASON_OPTIONS.includes(tag));
    const noteValue =
      rejectionMeta && Object.prototype.hasOwnProperty.call(rejectionMeta, "note")
        ? (rejectionMeta?.note || "").trim()
        : null;
    const hasNoteInput = noteValue !== null;
    const hasFeedbackPayload = validTags.length > 0 || (hasNoteInput && noteValue.length > 0);

    if (Array.isArray(rejectionMeta?.tags)) {
      payload.rejectionReasonTags = validTags;
    }
    if (hasNoteInput) {
      payload.rejectionReasonNote = noteValue || null;
      payload.rejectionInsights = null;
      payload.rejectionInsightsExtractedAt = null;
      extractedNoteForTrigger = noteValue || "";
      shouldTriggerRejectionInsights = Boolean(noteValue);
    }
    if (hasFeedbackPayload) {
      payload.rejectionCapturedAt = serverTimestamp();
    }

    if (rejectionMeta?.disablePromptForApp === true) {
      payload.rejectionFeedbackPromptDisabledForApp = true;
      payload.rejectionFeedbackPromptDisabledAt = serverTimestamp();
    } else if (rejectionMeta?.disablePromptForApp === false) {
      payload.rejectionFeedbackPromptDisabledForApp = false;
      payload.rejectionFeedbackPromptDisabledAt = null;
    }

    if (rejectionMeta?.archiveNow) {
      payload.archivedAt = serverTimestamp();
      payload.archivedBy = userId;
    } else if (rejectionMeta?.archiveNow === false) {
      payload.archivedAt = null;
      payload.archivedBy = null;
    }
  } else {
    payload.archivedAt = null;
    payload.archivedBy = null;
  }

  await updateDoc(doc(db, COLLECTION_NAME, id), payload);

  if (shouldTriggerRejectionInsights) {
    triggerRejectionInsightsExtractionSilently(id, extractedNoteForTrigger);
  }
}

export async function updateRejectedApplicationFeedback(userId, id, feedback = {}) {
  if (!userId) throw new Error("updateRejectedApplicationFeedback requires userId");
  const tags = Array.isArray(feedback?.tags) ? feedback.tags : [];
  const validTags = tags.filter((tag) => REJECTION_REASON_OPTIONS.includes(tag));
  const note = typeof feedback?.note === "string" ? feedback.note.trim() : "";

  await updateDoc(doc(db, COLLECTION_NAME, id), {
    rejectionReasonTags: validTags,
    rejectionReasonNote: note || null,
    rejectionInsights: null,
    rejectionInsightsExtractedAt: null,
    rejectionCapturedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  triggerRejectionInsightsExtractionSilently(id, note);
}

export async function setRejectedFeedbackPromptDisabledForApp(userId, id, disabled) {
  if (!userId) throw new Error("setRejectedFeedbackPromptDisabledForApp requires userId");
  await updateDoc(doc(db, COLLECTION_NAME, id), {
    rejectionFeedbackPromptDisabledForApp: Boolean(disabled),
    rejectionFeedbackPromptDisabledAt: disabled ? serverTimestamp() : null,
    updatedAt: serverTimestamp()
  });
}

export async function archiveApplication(userId, id) {
  if (!userId) throw new Error("archiveApplication requires userId");
  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Application not found.");
  const data = snap.data();
  if (data?.userId !== userId) throw new Error("Not authorized to archive this application.");
  if (data?.status !== "Rejected") {
    throw new Error("Only rejected applications can be archived.");
  }
  await updateDoc(ref, { archivedAt: serverTimestamp(), archivedBy: userId, updatedAt: serverTimestamp() });
}

export async function unarchiveApplication(userId, id) {
  if (!userId) throw new Error("unarchiveApplication requires userId");
  const ref = doc(db, COLLECTION_NAME, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Application not found.");
  const data = snap.data();
  if (data?.userId !== userId) throw new Error("Not authorized to unarchive this application.");
  if (data?.status !== "Rejected") {
    throw new Error("Only rejected applications can be unarchived.");
  }
  await updateDoc(ref, { archivedAt: null, archivedBy: null, updatedAt: serverTimestamp() });
}
