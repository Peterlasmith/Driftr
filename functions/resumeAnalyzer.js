const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const OpenAI = require("openai");

function normalizeWhitespace(s) {
  return String(s || "")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function clampTextForPrompt(text, maxChars) {
  const t = normalizeWhitespace(text);
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars)}\n\n[TRUNCATED]`;
}

async function extractResumeText({ buffer, fileType, fileName }) {
  const type = String(fileType || "").toLowerCase();
  const name = String(fileName || "").toLowerCase();
  const isPdf = type.includes("pdf") || name.endsWith(".pdf");
  const isDocx =
    type.includes("officedocument.wordprocessingml.document") || name.endsWith(".docx");

  if (isPdf) {
    const result = await pdfParse(buffer);
    return normalizeWhitespace(result?.text || "");
  }

  if (isDocx) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeWhitespace(result?.value || "");
  }

  throw new Error("Unsupported file type. Upload a PDF or DOCX resume.");
}

function resumePrompt(resumeText) {
  return `Analyze this resume and provide a detailed assessment in JSON format:

{
  "primaryRole": "The specific job title this resume is best suited for",
  "seniorityLevel": "Entry-Level/Mid-Level/Senior/Lead/Director/VP/Executive",
  "confidenceScore": 0-100,
  "yearsOfExperience": "X-Y years",
  "keyStrengths": ["strength 1", "strength 2", "strength 3"],
  "senioritySignals": ["specific examples from resume that indicate this level"],
  "gapsForNextLevel": ["what's missing to reach the next level up"],
  "alternativeRoles": [
    {"title": "Alternative role 1", "matchScore": 0-100},
    {"title": "Alternative role 2", "matchScore": 0-100}
  ],
  "summary": "2-3 sentence explanation of the assessment"
}

Resume text:
${resumeText}`;
}

function safeParseJsonObject(maybeJson) {
  if (!maybeJson) return null;
  if (typeof maybeJson === "object") return maybeJson;
  const s = String(maybeJson || "").trim();
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    // Try to salvage the first JSON object.
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const slice = s.slice(start, end + 1);
    try {
      return JSON.parse(slice);
    } catch {
      return null;
    }
  }
}

async function analyzeResumeWithOpenAI({ resumeText }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const client = new OpenAI({ apiKey });
  const promptText = resumePrompt(clampTextForPrompt(resumeText, 12000));

  const resp = await client.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You are a resume analyst. Return only valid JSON. Do not include markdown or extra keys."
      },
      { role: "user", content: promptText }
    ]
  });

  const content = resp?.choices?.[0]?.message?.content || "";
  const parsed = safeParseJsonObject(content);
  if (!parsed) throw new Error("OpenAI returned invalid JSON");
  return parsed;
}

module.exports = {
  analyzeResumeWithOpenAI,
  extractResumeText
};

