const KEY = "frenchvoice-scenes-v1";
const MAX_CUSTOM = 24;
const MAX_STARRED = 40;

export function isCustomSceneId(id) {
  return id === "custom" || String(id || "").startsWith("custom:");
}

function empty() {
  return { starred: [], custom: [] };
}

export function loadSavedScenes() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    const starred = Array.isArray(parsed?.starred)
      ? parsed.starred.filter((id) => typeof id === "string" && id && !isCustomSceneId(id) && id !== "surprise")
      : [];
    const custom = Array.isArray(parsed?.custom)
      ? parsed.custom
          .filter((s) => s && typeof s.id === "string" && typeof s.prompt === "string" && s.prompt.trim())
          .map((s) => ({
            id: s.id,
            title: String(s.title || "Scène perso").slice(0, 60),
            prompt: String(s.prompt).trim().slice(0, 500),
            createdAt: Number(s.createdAt) || 0,
          }))
      : [];
    return { starred: starred.slice(-MAX_STARRED), custom: custom.slice(0, MAX_CUSTOM) };
  } catch {
    return empty();
  }
}

function persist(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
  return data;
}

export function isStarred(id, saved = loadSavedScenes()) {
  return saved.starred.includes(id);
}

export function toggleStar(id) {
  if (!id || isCustomSceneId(id) || id === "surprise") return loadSavedScenes();
  const data = loadSavedScenes();
  data.starred = data.starred.includes(id)
    ? data.starred.filter((item) => item !== id)
    : [...data.starred, id].slice(-MAX_STARRED);
  return persist(data);
}

export function titleFromPrompt(prompt) {
  const text = String(prompt || "").replace(/\s+/g, " ").trim();
  if (!text) return "Scène perso";
  const first = text.split(/[.!?]/)[0].trim() || text;
  if (first.length <= 42) return first;
  return `${first.slice(0, 41).replace(/[,;:\s]+$/, "")}…`;
}

export function saveCustomScene({ title, prompt }) {
  const text = String(prompt || "").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!text) return { data: loadSavedScenes(), scene: null };
  const data = loadSavedScenes();
  const scene = {
    id: `custom:${crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`}`,
    title: String(title || titleFromPrompt(text)).trim().slice(0, 60) || "Scène perso",
    prompt: text,
    createdAt: Date.now(),
  };
  data.custom = [scene, ...data.custom].slice(0, MAX_CUSTOM);
  persist(data);
  return { data, scene };
}

export function removeCustomScene(id) {
  const data = loadSavedScenes();
  data.custom = data.custom.filter((s) => s.id !== id);
  return persist(data);
}

export function findCustomScene(id, saved = loadSavedScenes()) {
  return saved.custom.find((s) => s.id === id) || null;
}
