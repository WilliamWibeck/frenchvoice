// Local development only — NOT deployed. On Vercel, api/scenarios.js,
// api/session.js and api/correct.js run automatically as serverless
// functions and the built Vite app is served as static files — no
// server needed there at all.
//
// Locally, Vite's dev server (and `vite preview`) only handles the
// frontend, so this tiny Express server exists purely to run those same
// handler files on :3001. vite.config.js proxies /api/* here so
// `npm run dev` feels like one app even though it's two processes.

import "dotenv/config";
import express from "express";
import scenariosHandler from "./api/scenarios.js";
import sessionHandler from "./api/session.js";
import correctHandler from "./api/correct.js";
import { getGeminiApiKey } from "./lib/gemini.js";

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(express.json({ limit: "32kb" }));
app.get("/api/scenarios", scenariosHandler);
app.get("/api/session", sessionHandler);
app.post("/api/session", sessionHandler);
app.post("/api/correct", correctHandler);

app.listen(PORT, () => {
  console.log(`API dev server running at http://localhost:${PORT}`);
  if (!getGeminiApiKey()) {
    console.warn("WARNING: GEMINI_API_KEY is not set. /api/session will fail until it is.");
  }
});
