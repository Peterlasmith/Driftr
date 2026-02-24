import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from "firebase/firestore";
import { db } from "../config/firebase";

const COLLECTION_NAME = "userPreferences";

export const DEFAULT_USER_PREFERENCES = {
  rejectedFeedbackPromptEnabled: true
};

function normalizeUserPreferences(data) {
  return {
    ...DEFAULT_USER_PREFERENCES,
    rejectedFeedbackPromptEnabled:
      data?.rejectedFeedbackPromptEnabled === false ? false : true
  };
}

export function subscribeToUserPreferences(userId, onData, onError) {
  if (!userId) throw new Error("subscribeToUserPreferences requires userId");
  const ref = doc(db, COLLECTION_NAME, userId);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onData({ ...DEFAULT_USER_PREFERENCES });
        return;
      }
      onData(normalizeUserPreferences(snap.data()));
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function getUserPreferences(userId) {
  if (!userId) throw new Error("getUserPreferences requires userId");
  const snap = await getDoc(doc(db, COLLECTION_NAME, userId));
  if (!snap.exists()) return { ...DEFAULT_USER_PREFERENCES };
  return normalizeUserPreferences(snap.data());
}

export async function upsertUserPreferences(userId, partial) {
  if (!userId) throw new Error("upsertUserPreferences requires userId");
  const ref = doc(db, COLLECTION_NAME, userId);
  const next = {};

  if (Object.prototype.hasOwnProperty.call(partial || {}, "rejectedFeedbackPromptEnabled")) {
    next.rejectedFeedbackPromptEnabled = Boolean(partial.rejectedFeedbackPromptEnabled);
  }

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      userId,
      ...DEFAULT_USER_PREFERENCES,
      ...next,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return;
  }

  await updateDoc(ref, {
    ...next,
    updatedAt: serverTimestamp()
  });
}
