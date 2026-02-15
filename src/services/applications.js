import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from "firebase/firestore";
import { db } from "../config/firebase";

const COLLECTION_NAME = "applications";

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
    resumeVersion: data?.resumeVersion ?? "",
    notes: data?.notes ?? ""
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
    resumeVersion: input.resumeVersion?.trim() || null,
    notes: input.notes?.trim() || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  const ref = await addDoc(collection(db, COLLECTION_NAME), payload);
  return ref.id;
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
  await updateDoc(doc(db, COLLECTION_NAME, id), { status, updatedAt: serverTimestamp() });
}
