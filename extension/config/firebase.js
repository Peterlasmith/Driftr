import { initializeApp } from "firebase/app";
import { addDoc, collection, getFirestore, serverTimestamp } from "firebase/firestore";

// Chrome extensions can't rely on .env at runtime, so config must live in code.
// This is safe to ship (Firebase web config is not a secret), but your Firestore Security Rules must enforce access.
const firebaseConfig = {
  apiKey: "AIzaSyAzB92heYQ6dHSWflYRFhsOggAo1lsx8Xw",
  authDomain: "driftr-6f605.firebaseapp.com",
  projectId: "driftr-6f605",
  storageBucket: "driftr-6f605.firebasestorage.app",
  messagingSenderId: "1013063929162",
  appId: "1:1013063929162:web:4f4a3dd6d109fd39ac45b3",
  measurementId: "G-QQ0VMZHX7F"
};

let db;

function ensureDb() {
  if (db) return db;
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  return db;
}

export async function writeApplicationToFirestore(application) {
  const firestore = ensureDb();

  const payload = {
    jobTitle: String(application?.jobTitle || ""),
    company: String(application?.companyName || application?.company || ""),
    jobUrl: String(application?.jobUrl || ""),
    dateApplied: serverTimestamp(),
    status: "Applied"
  };

  const resumeVersion = String(application?.resumeFileName || application?.resumeVersion || "").trim();
  if (resumeVersion) payload.resumeVersion = resumeVersion;

  const notes = String(application?.notes || "").trim();
  if (notes) payload.notes = notes;

  await addDoc(collection(firestore, "applications"), payload);
  return true;
}
