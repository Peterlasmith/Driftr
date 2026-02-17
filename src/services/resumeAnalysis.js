import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export async function analyzeResume(resumeId) {
  const endpoint = process.env.REACT_APP_RESUME_ANALYZER_ENDPOINT;
  if (!endpoint) throw new Error("Missing REACT_APP_RESUME_ANALYZER_ENDPOINT");
  const token = await getIdToken();
  if (!token) throw new Error("Please sign in again.");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ resumeId })
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Resume analysis request failed");
  if (!data?.ok) throw new Error(data?.error || "Resume analysis failed");
  return data;
}

export async function setResumeAnalysisFeedback(resumeId, feedback) {
  const value = feedback === "thumbs_up" || feedback === "thumbs_down" ? feedback : null;
  await updateDoc(doc(db, "resumes", resumeId), {
    feedback: value,
    feedbackAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

