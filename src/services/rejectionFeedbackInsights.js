import { auth } from "../config/firebase";

async function getIdToken() {
  const user = auth.currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}

export async function extractRejectionInsights(applicationId) {
  const endpoint = process.env.REACT_APP_REJECTION_INSIGHTS_ENDPOINT;
  if (!endpoint) throw new Error("Missing REACT_APP_REJECTION_INSIGHTS_ENDPOINT");
  const token = await getIdToken();
  if (!token) throw new Error("Please sign in again.");

  const id = String(applicationId || "").trim();
  if (!id) throw new Error("Missing applicationId");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ applicationId: id })
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Rejection insights request failed");
  if (!data?.ok) throw new Error(data?.error || "Rejection insights extraction failed");
  return data;
}
