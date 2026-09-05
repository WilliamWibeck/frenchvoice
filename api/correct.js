import { GoogleGenAI } from "@google/genai";
import { CORRECTION_MODEL } from "../lib/scenarios-data.js";
import { getGeminiApiKey } from "../lib/gemini.js";
import {
  CORRECTION_PROMPT,
  FEEDBACK_SCHEMA,
  normalizeFeedback,
  parseModelJson,
} from "../lib/feedback.js";

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
        responseMimeType: "application/json",
        responseJsonSchema: FEEDBACK_SCHEMA,
      },
    });

    const parsed = parseModelJson(result.text || "");
    const feedback = normalizeFeedback(parsed || {}, text);
    // Surfaced so the client-side cost meter can price the correction line.
    const u = result.usageMetadata || {};
    res.status(200).json({
      feedback,
      usage: {
        inTokens: u.promptTokenCount || 0,
        outTokens: u.candidatesTokenCount || u.responseTokenCount || 0,
      },
    });
  } catch (err) {
    console.error("Gemini correction check failed:", err);
    res.status(500).json({
      error: "Failed to check utterance",
      detail: String(err?.message || err),
    });
  }
}
