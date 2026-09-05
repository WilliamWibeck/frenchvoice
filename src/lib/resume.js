const KEY = "frenchvoice-resume";

export function loadResume() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.scenarioId || !parsed?.title) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveResume(entry) {
  if (!entry?.scenarioId || !entry?.title) return;
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        scenarioId: entry.scenarioId,
        title: entry.title,
        mission: entry.mission || "",
        focus: entry.focus || "",
        daily: !!entry.daily,
        topic: entry.topic || "",
        customPrompt: entry.customPrompt || "",
        customTitle: entry.customTitle || "",
      })
    );
  } catch {
    /* ignore */
  }
}

export function clearResume() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
