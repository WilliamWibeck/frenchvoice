import { GoogleGenAI } from "@google/genai";
import { CORRECTION_MODEL, CORRECTION_PROMPT } from "../lib/scenarios-data.js";
import { getGeminiApiKey } from "../lib/gemini.js";

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return {};
}

// Text-only grammar check, kept off the spoken Live session so corrections
// never interrupt the conversation.
export default async function handler(req, res) {
  if (req.method && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return res.status(500).json({ error: "Server is missing GEMINI_API_KEY." });
  }

  const body = readBody(req);
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) {
    return res.status(400).json({ error: "Missing text to check." });
  }

  try {
    const client = new GoogleGenAI({ apiKey });
    const result = await client.models.generateContent({
      model: CORRECTION_MODEL,
      contents: `The learner said: "${text}"`,
      config: {
        systemInstruction: CORRECTION_PROMPT,
        temperature: 0.2,
      },
    });

    res.status(200).json({ correction: (result.text || "").trim() });
  } catch (err) {
    console.error("Gemini correction check failed:", err);
    res.status(500).json({
      error: "Failed to check utterance",
      detail: String(err?.message || err),
    });
  }
}
