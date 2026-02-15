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

export async function parseJobUrl(jobUrl) {
  const endpoint = process.env.REACT_APP_JOB_URL_PARSER_ENDPOINT;
  if (!endpoint) throw new Error("Missing REACT_APP_JOB_URL_PARSER_ENDPOINT");

  const token = await getIdToken();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : null)
    },
    body: JSON.stringify({ url: jobUrl })
  });

  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || "Parser request failed");
  return data;
}

