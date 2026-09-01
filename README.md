# Pratique orale — French speaking practice (voice-to-voice)

A small web app for practicing spoken French out loud with an AI
conversation partner. You talk into your microphone, it talks back in
French in real time (Gemini Live API, model `gemini-3.1-flash-live-preview`),
and a side panel quietly flags grammar/vocabulary mistakes as text —
without interrupting the spoken conversation.

Six modes: free conversation, café, bakery, asking for directions, hotel
check-in, and small talk — all tuned for an A1–A2 (beginner) level.

**Stack:** Vite + React frontend, deployed on **Vercel** as a static site;
`api/scenarios.js`, `api/session.js`, and `api/correct.js` deploy
automatically as Vercel serverless functions — no separate backend to host.

## 1. Get a Gemini API key

1. Go to https://aistudio.google.com/apikey and sign in with a Google account.
2. Create an API key. Copy it immediately.
3. Optional but recommended: enable billing and set a budget alert in
   Google AI Studio / Cloud billing so a stuck session can't run away on
   you. Live API has a free quota, then pay-as-you-go.

Keep this key secret. It should only ever live as a server-side
environment variable (`GEMINI_API_KEY`) — never in the frontend code. The
browser only ever talks to `/api/session` (and `/api/correct`), which are
the places the real key gets used.

## 2. Run it locally

```
npm install
cp .env.example .env   # then paste your real key into .env
npm run dev
```

This starts **two** processes together (via `concurrently`): Vite's dev
server on `http://localhost:5173` (open this one) and a small local API
server on `:3001` that runs the exact same `api/` handlers Vercel uses in
production. Vite proxies `/api/*` requests to it automatically, so it
feels like one app.

`npm run build` + `npm run preview` does the same thing against the
production build, if you want to sanity-check the built output before
deploying.

## 3. Deploy to Vercel

1. Push this folder to a new GitHub repository (create one at
   github.com/new, then from inside this folder: `git init`,
   `git add .`, `git commit -m "French practice app"`, add the remote,
   `git push`).
2. Go to https://vercel.com/new and import that GitHub repo. Vercel
   auto-detects Vite (build command `vite build`, output directory
   `dist`) — you shouldn't need to change anything.
3. Add an environment variable before or right after the first deploy:
   **Project → Settings → Environment Variables** → `GEMINI_API_KEY` =
   your real key. Apply it to Production (and Preview if you want branch
   previews to work too).
4. Deploy. Vercel gives you a `https://your-app.vercel.app` URL — open it
   on your phone or laptop, allow microphone access, and start talking.

Any time you edit the code and push to GitHub, Vercel redeploys
automatically.

## How it works

- The browser never sees your API key. It calls this app's own
  `/api/session` endpoint, which uses the real key server-side to mint a
  short-lived Gemini Live ephemeral token, then hands only that token to
  the browser.
- The browser opens a WebSocket directly to Gemini Live using that token
  — your mic is captured as 16 kHz PCM, the model's 24 kHz voice streams
  back, with low latency. All of this lives in the `useRealtimeSession`
  hook (`src/hooks/useRealtimeSession.js`).
- After each thing you say, `/api/correct` silently re-checks the
  transcript with a text-only Gemini Flash call that either says "OK" or
  gives a one-line correction. That's what populates the corrections
  panel — it never gets spoken out loud, so it doesn't break the flow of
  conversation.

## Project structure

```
index.html              Vite entry point
src/
  main.jsx              React root
  App.jsx                Screen switching (picker vs. call)
  index.css              All styling (plain CSS, no framework)
  hooks/
    useRealtimeSession.js   Gemini Live WebSocket + PCM audio + state
  lib/
    pcmAudio.js             Mic capture and playback helpers
  components/
    ScenarioPicker.jsx
    CallScreen.jsx
    TranscriptPanel.jsx
    CorrectionsPanel.jsx
api/
  scenarios.js           Vercel function: list of scenarios
  session.js              Vercel function: mints the ephemeral Live token
  correct.js              Vercel function: text-only grammar check
lib/
  scenarios-data.js       Scenario prompts + model name (shared, server-only)
  gemini.js               GEMINI_API_KEY / GOOGLE_API_KEY lookup
api-dev-server.js          Local-only: runs the api/ handlers on :3001
```

## Cost notes

Two things get billed: the Live audio conversation itself, and the small
text-only correction check after each thing you say.

- Live audio (`gemini-3.1-flash-live-preview`): billed per audio token;
  roughly a few cents per minute of back-and-forth, with a free quota on
  the Gemini API. Check https://ai.google.dev/gemini-api/docs/pricing
  for current rates.
- Correction checks (`gemini-2.5-flash`): tiny — a few hundred text
  tokens each.

## Customizing

- Scenarios live in `lib/scenarios-data.js` — edit the `instructions`
  text to change personality, difficulty, or add new scenarios (add a
  new key to `SCENARIOS`; the picker UI picks it up automatically).
- The correction prompt lives in `CORRECTION_PROMPT` in
  `lib/scenarios-data.js` — tune it to be stricter/looser, or to target
  intermediate level instead of beginner.
- The voice is set to `Kore` (`REALTIME_VOICE`) — Gemini Live also
  offers `Puck`, `Charon`, `Fenrir`, `Aoede`, and others.
- Styling is one plain CSS file (`src/index.css`), no Tailwind/CSS
  modules — easiest to just edit directly.
