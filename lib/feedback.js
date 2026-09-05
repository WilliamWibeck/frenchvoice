export const CATEGORIES = {
  present: { id: "present", label: "Présent" },
  passe_compose: { id: "passe_compose", label: "Passé composé" },
  futur_proche: { id: "futur_proche", label: "Futur proche" },
  gender: { id: "gender", label: "Gender" },
  articles: { id: "articles", label: "Articles" },
  questions: { id: "questions", label: "Questions" },
  conjugation: { id: "conjugation", label: "Conjugation" },
  vocab: { id: "vocab", label: "Vocabulary" },
  word_order: { id: "word_order", label: "Word order" },
};

export const CATEGORY_IDS = Object.keys(CATEGORIES);

export const FOCUS_OPTIONS = [
  { id: "present", label: "Présent" },
  { id: "passe_compose", label: "Passé composé" },
  { id: "futur_proche", label: "Futur proche" },
  { id: "questions", label: "Questions" },
];
const VERDICTS = new Set(["ok", "correction", "unclear"]);
const SEVERITIES = new Set(["none", "minor", "major"]);

export const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["ok", "correction", "unclear"] },
    severity: { type: "string", enum: ["none", "minor", "major"] },
    category: { type: "string", enum: [...CATEGORY_IDS, "none"] },
    corrected: { type: "string" },
    errorPhrase: { type: "string" },
    explain: { type: "string" },
    structuresUsed: {
      type: "array",
      items: { type: "string", enum: CATEGORY_IDS },
    },
    tipFr: { type: "string" },
    tipEn: { type: "string" },
    vocabFr: { type: "string" },
    vocabEn: { type: "string" },
  },
  // `original` is deliberately not requested back — the server already has the
  // utterance and normalizeFeedback falls back to it, so echoing it would just
  // burn output tokens, the priciest part of this call.
  required: ["verdict", "severity"],
};

export const CORRECTION_PROMPT = `You are a supportive French tutor for an A1-A2 (beginner) learner.
You will be shown one transcribed utterance they just spoke. The transcript
may contain speech-recognition noise.

Return JSON only, matching the schema.

Rules:
- verdict "ok": understandable beginner French, even if very simple.
- verdict "correction": there is a real language mistake.
- verdict "unclear": the text looks like English, gibberish, or a bad transcript
  — do not treat that as a grammar error.
- severity "major": meaning is broken, wrong word, or a tense that derails the
  scene. Only major mistakes should feel like "you got this wrong".
- severity "minor": still understandable (gender on a known noun, article slip).
  Prefer a short tip over a harsh correction.
- Flag at most ONE issue, the most important. Ignore the rest.
- category: the grammar area of that one issue, or "none".
- errorPhrase: the exact substring of the utterance that is wrong, if any.
- corrected: the full utterance fixed, natural beginner French. Empty if ok/unclear.
- explain: max 12 English words. Empty if ok.
- structuresUsed: which of these they attempted, even if correct:
  present, passe_compose, futur_proche, gender, articles, questions,
  conjugation, vocab, word_order. Empty array if none are clear.
- tipFr / tipEn: optional upgrade or useful phrase (not a scolding).
  Fill these when the turn is mostly fine, or as "you could also say…".
  Leave empty if you already gave a major correction, or if you have nothing
  useful. Keep tipFr short.
- vocabFr / vocabEn: one useful word or short chunk from this turn to remember
  (especially a word they missed or a better alternative). Empty if none.

Do not use markdown. Do not add extra keys.`;

export function parseModelJson(text) {
  if (!text || typeof text !== "string") return null;
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

export function locateErrorSpan(original, errorPhrase) {
  if (!original || !errorPhrase) return null;
  const hay = original.toLowerCase();
  const needle = errorPhrase.toLowerCase().trim();
  if (!needle) return null;
  const idx = hay.indexOf(needle);
  if (idx < 0) return null;
  return { start: idx, end: idx + errorPhrase.trim().length };
}

function cleanText(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}

export function normalizeFeedback(raw, spoken) {
  const src = raw && typeof raw === "object" ? raw : {};
  const original = cleanText(src.original) || cleanText(spoken);
  let verdict = VERDICTS.has(src.verdict) ? src.verdict : "ok";
  if (verdict === "ok" && typeof src.correction === "string") {
    const legacy = src.correction.trim();
    if (legacy && legacy.toUpperCase() !== "OK") verdict = "correction";
  }

  let severity = SEVERITIES.has(src.severity) ? src.severity : "none";
  if (verdict === "correction" && severity === "none") severity = "major";
  if (verdict !== "correction") severity = verdict === "unclear" ? "none" : "none";
  if (verdict === "ok") severity = "none";

  const category = CATEGORY_IDS.includes(src.category) ? src.category : null;
  const corrected = verdict === "correction" ? cleanText(src.corrected) : "";
  const errorPhrase = cleanText(src.errorPhrase);
  const explain = cleanText(src.explain);
  const structuresUsed = Array.isArray(src.structuresUsed)
    ? src.structuresUsed.filter((id) => CATEGORY_IDS.includes(id))
    : [];

  const tipFr = cleanText(src.tipFr);
  const tipEn = cleanText(src.tipEn);
  const tip = tipFr ? { fr: tipFr, en: tipEn } : null;

  const vocabFr = cleanText(src.vocabFr);
  const vocabEn = cleanText(src.vocabEn);
  const vocab = vocabFr ? [{ fr: vocabFr, en: vocabEn }] : [];

  return {
    verdict,
    severity,
    category,
    original,
    corrected,
    errorPhrase,
    span: locateErrorSpan(original, errorPhrase),
    explain,
    structuresUsed,
    tip,
    vocab,
    isMajor: verdict === "correction" && severity === "major",
    isMinor: verdict === "correction" && severity === "minor",
  };
}

export function pickTakeaways(items) {
  const list = items || [];
  const majors = list.filter((i) => i.isMajor);
  const minors = list.filter((i) => i.isMinor);
  const tips = list.filter((i) => i.tip && i.tip.fr);
  const oks = list.filter(
    (i) => i.verdict === "ok" && (i.original || "").split(/\s+/).filter(Boolean).length >= 4
  );
  return {
    correction: majors[0] || minors[0] || null,
    tip: tips.length ? tips[tips.length - 1] : null,
    keep: oks.length ? oks[oks.length - 1] : null,
  };
}

export function categoryLabel(id) {
  return (CATEGORIES[id] && CATEGORIES[id].label) || id || "";
}

export function collectVocab(items) {
  const seen = new Set();
  const out = [];
  for (const fb of items || []) {
    for (const v of fb.vocab || []) {
      const fr = (v.fr || "").trim();
      if (!fr) continue;
      const key = fr.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ fr, en: (v.en || "").trim() });
    }
  }
  return out.slice(0, 8);
}
