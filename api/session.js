import { GoogleGenAI, Modality } from "@google/genai";
import {
  REALTIME_MODEL,
  REALTIME_VOICE,
  resolveScenario,
} from "../lib/scenarios-data.js";
import { getGeminiApiKey } from "../lib/gemini.js";

function readSessionInput(req) {
  const query = req.query || {};
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  if (!body || typeof body !== "object") body = {};
  return {
    scenario: body.scenario || query.scenario,
    topic: body.topic || query.topic || "",
  };
}

// Mints a short-lived Gemini Live API token scoped to the chosen scenario.
// This is the only place the real GEMINI_API_KEY is ever used for realtime
// audio — it never reaches the browser. Set GEMINI_API_KEY as an environment
// variable in your Vercel project settings (or a local .env for `npm run dev`).
export default async function handler(req, res) {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    return res.status(500).json({
      error:
        "Server is missing GEMINI_API_KEY. Set it as an environment variable and redeploy.",
    });
  }

  const input = readSessionInput(req);
  const scenario = resolveScenario(input.scenario, { topic: input.topic });

  try {
    const client = new GoogleGenAI({
      apiKey,
      apiVersion: "v1alpha",
    });

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        newSessionExpireTime: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
        httpOptions: { apiVersion: "v1alpha" },
        liveConnectConstraints: {
          model: REALTIME_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: scenario.instructions,
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: REALTIME_VOICE },
              },
              languageCode: "fr-FR",
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
        },
      },
    });

    if (!token?.name) {
      return res.status(502).json({ error: "Failed to create realtime session" });
    }

    res.status(200).json({
      value: token.name,
      model: REALTIME_MODEL,
      voice: REALTIME_VOICE,
      instructions: scenario.instructions,
      scenarioId: scenario.id,
      scenarioTitle: scenario.title,
      mission: scenario.mission,
    });
  } catch (err) {
    console.error("Gemini session creation failed:", err);
    res.status(500).json({
      error: "Failed to create realtime session",
      detail: String(err?.message || err),
    });
  }
}
