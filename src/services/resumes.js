import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref as storageRef, uploadBytes } from "firebase/storage";
import { db, storage } from "../config/firebase";
import { findLegacyResumeRelinks } from "./resumeRelinking";

const RESUMES_COLLECTION = "resumes";
const APPLICATIONS_COLLECTION = "applications";

function toJsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === "function") return value.toDate();
  return null;
}

function normalizeResume(id, data) {
  return {
    id,
    userId: data?.userId ?? "",
    versionName: data?.versionName ?? "",
    fileName: data?.fileName ?? "",
    fileUrl: data?.fileUrl ?? "",
    storagePath: data?.storagePath ?? "",
    uploadDate: toJsDate(data?.uploadDate),
    fileSize: data?.fileSize ?? 0,
    fileType: data?.fileType ?? "",
    analysisResult: data?.analysisResult ?? null,
    analyzedAt: toJsDate(data?.analyzedAt),
    feedback: data?.feedback ?? null,
    feedbackAt: toJsDate(data?.feedbackAt)
  };
}

export function subscribeToResumes(userId, onData, onError) {
  if (!userId) throw new Error("subscribeToResumes requires userId");
  const q = query(
    collection(db, RESUMES_COLLECTION),
    where("userId", "==", userId),
    orderBy("uploadDate", "desc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const rows = snap.docs.map((d) => normalizeResume(d.id, d.data()));
      onData(rows);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export function getNextResumeVersionName(existingResumes) {
  const re = /^Resume v(\d+)$/i;
  const max = (existingResumes || []).reduce((acc, r) => {
    const m = re.exec(String(r?.versionName || "").trim());
    if (!m) return acc;
    const n = Number(m[1]);
    if (!Number.isFinite(n)) return acc;
    return Math.max(acc, n);
  }, 0);
  return `Resume v${max + 1}`;
}

function inferExtension(file) {
  const name = String(file?.name || "");
  const idx = name.lastIndexOf(".");
  const ext = idx === -1 ? "" : name.slice(idx).toLowerCase();
  if (ext === ".pdf" || ext === ".docx") return ext;
  if (file?.type === "application/pdf") return ".pdf";
  if (
    file?.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return ".docx";
  }
  return "";
}

export function validateResumeFile(file) {
  if (!file) return { ok: false, error: "Choose a file to upload." };
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) return { ok: false, error: "File is too large (max 5MB)." };
  const ext = inferExtension(file);
  if (!ext) return { ok: false, error: "Only .pdf or .docx files are allowed." };
  return { ok: true, ext };
}

export async function uploadResumeFile(userId, { file, versionName }) {
  if (!userId) throw new Error("uploadResumeFile requires userId");
  const validated = validateResumeFile(file);
  if (!validated.ok) throw new Error(validated.error);

  const resumeDoc = await addDoc(collection(db, RESUMES_COLLECTION), {
    userId,
    versionName: versionName?.trim() || null,
    fileName: file.name,
    fileUrl: null,
    storagePath: null,
    uploadDate: serverTimestamp(),
    fileSize: file.size,
    fileType: file.type || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  const ext = validated.ext;
  const path = `resumes/${userId}/${resumeDoc.id}${ext}`;
  const objectRef = storageRef(storage, path);

  await uploadBytes(objectRef, file, { contentType: file.type || undefined });
  const url = await getDownloadURL(objectRef);

  const finalVersionName = versionName?.trim() || "Resume";
  await updateDoc(doc(db, RESUMES_COLLECTION, resumeDoc.id), {
    versionName: finalVersionName,
    fileUrl: url,
    storagePath: path,
    updatedAt: serverTimestamp()
  });

  return resumeDoc.id;
}

export async function renameResume(userId, resumeId, nextName) {
  if (!userId) throw new Error("renameResume requires userId");
  if (!resumeId) throw new Error("renameResume requires resumeId");
  const clean = String(nextName || "").trim();
  if (!clean) throw new Error("Resume name can’t be empty.");
  await updateDoc(doc(db, RESUMES_COLLECTION, resumeId), {
    versionName: clean,
    updatedAt: serverTimestamp()
  });
}

export async function relinkLegacyApplications(userId, resumes, applications) {
  if (!userId) throw new Error("relinkLegacyApplications requires userId");

  const relinks = findLegacyResumeRelinks(resumes, applications);
  if (relinks.length === 0) return 0;

  const batch = writeBatch(db);
  relinks.forEach(({ applicationId, resumeId }) => {
    batch.update(doc(db, APPLICATIONS_COLLECTION, applicationId), {
      resumeVersionId: resumeId,
      resumeVersion: null,
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();
  return relinks.length;
}

export async function deleteResumeAndUnlinkApplications(userId, resume) {
  if (!userId) throw new Error("deleteResumeAndUnlinkApplications requires userId");
  if (!resume?.id) throw new Error("deleteResumeAndUnlinkApplications requires resume");

  const batch = writeBatch(db);
  const appsQ = query(
    collection(db, APPLICATIONS_COLLECTION),
    where("userId", "==", userId),
    where("resumeVersionId", "==", resume.id)
  );
  const appsSnap = await getDocs(appsQ);
  appsSnap.forEach((d) => {
    batch.update(d.ref, {
      resumeVersionId: null,
      resumeVersion: resume?.versionName || "Deleted resume",
      updatedAt: serverTimestamp()
    });
  });
  batch.delete(doc(db, RESUMES_COLLECTION, resume.id));
  await batch.commit();

  if (resume?.storagePath) {
    try {
      await deleteObject(storageRef(storage, resume.storagePath));
    } catch (err) {
      // ignore missing file / already deleted
    }
  }
}
