import { CATEGORY_IDS, categoryLabel, collectVocab } from "../../lib/feedback.js";

const STORAGE_KEY = "frenchvoice-stats-v1";
const MAX_SESSIONS = 80;

export function emptyStats() {
  return { sessions: [] };
}

export function loadStats() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyStats();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sessions)) return emptyStats();
    return parsed;
  } catch {
    return emptyStats();
  }
}

export function recordSession(entry) {
  const stats = loadStats();
  stats.sessions = [entry, ...stats.sessions].slice(0, MAX_SESSIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  return stats;
}

export function resetStats() {
  const stats = emptyStats();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  return stats;
}

export function localDateKey(ts) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatMinutes(ms) {
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return ms > 0 ? "<1 min" : "0 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

export function accuracyPct(utterances, corrections) {
  if (!utterances) return null;
  const ok = Math.max(0, utterances - corrections);
  return Math.round((ok / utterances) * 100);
}

function dayKeysBack(n) {
  const keys = [];
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    keys.push(localDateKey(d.getTime()));
  }
  return keys;
}

function computeStreak(dateSet) {
  if (!dateSet.size) return 0;
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const todayKey = localDateKey(today.getTime());
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayKey = localDateKey(yesterday.getTime());
  if (!dateSet.has(todayKey) && !dateSet.has(yesterdayKey)) return 0;

  let streak = 0;
  const cursor = new Date(today);
  if (!dateSet.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
  while (dateSet.has(localDateKey(cursor.getTime()))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export function summarizeStats(stats) {
  const sessions = stats?.sessions || [];
  const counted = sessions.filter((s) => s.utterances > 0 || s.durationMs >= 10000);
  const totalMs = counted.reduce((sum, s) => sum + (s.durationMs || 0), 0);
  const utterances = counted.reduce((sum, s) => sum + (s.utterances || 0), 0);
  const corrections = counted.reduce((sum, s) => sum + (s.corrections || 0), 0);
  const dateSet = new Set(counted.map((s) => localDateKey(s.startedAt)));
  const weekKeys = dayKeysBack(7);
  const byDay = {};
  for (const key of weekKeys) byDay[key] = { date: key, minutes: 0, sessions: 0 };
  for (const s of counted) {
    const key = localDateKey(s.startedAt);
    if (!byDay[key]) continue;
    byDay[key].minutes += s.durationMs / 60000;
    byDay[key].sessions += 1;
  }

  const byScenario = {};
  for (const s of counted) {
    const id = s.scenarioId || "free";
    if (!byScenario[id]) {
      byScenario[id] = {
        id,
        title: id === "surprise" ? "Surprise-moi" : (s.scenarioTitle || id),
        sessions: 0,
        ms: 0,
        utterances: 0,
        corrections: 0,
      };
    }
    const row = byScenario[id];
    row.sessions += 1;
    row.ms += s.durationMs || 0;
    row.utterances += s.utterances || 0;
    row.corrections += s.corrections || 0;
    if (id !== "surprise") row.title = s.scenarioTitle || row.title;
  }

  return {
    totalSessions: counted.length,
    totalMs,
    utterances,
    corrections,
    accuracy: accuracyPct(utterances, corrections),
    streak: computeStreak(dateSet),
    week: weekKeys.map((key) => ({
      date: key,
      minutes: byDay[key].minutes,
      sessions: byDay[key].sessions,
    })),
    byScenario: Object.values(byScenario).sort((a, b) => b.sessions - a.sessions),
    categories: categoryProgress({ sessions: counted }),
    recent: counted.slice(0, 8),
  };
}

export function shouldRecord(recap) {
  if (!recap) return false;
  return (recap.utterances || 0) > 0 || (recap.durationMs || 0) >= 10000;
}

export function recentVocab(stats, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const session of stats?.sessions || []) {
    const words = session.vocab?.length ? session.vocab : collectVocab(session.feedback);
    for (const v of words) {
      const fr = (v.fr || "").trim();
      if (!fr) continue;
      const key = fr.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ fr, en: (v.en || "").trim() });
      if (out.length >= limit) return out;
    }
  }
  return out;
}

export function categoryProgress(stats) {
  const totals = {};
  for (const id of CATEGORY_IDS) {
    totals[id] = { id, attempts: 0, errors: 0 };
  }
  for (const session of stats?.sessions || []) {
    for (const fb of session.feedback || []) {
      const used = new Set(fb.structuresUsed || []);
      if (fb.category) used.add(fb.category);
      for (const id of used) {
        if (!totals[id]) continue;
        totals[id].attempts += 1;
        if (fb.isMajor && fb.category === id) totals[id].errors += 1;
      }
    }
  }
  return Object.values(totals)
    .filter((row) => row.attempts > 0)
    .map((row) => ({
      ...row,
      accuracy: accuracyPct(row.attempts, row.errors),
      label: categoryLabel(row.id),
    }))
    .sort((a, b) => b.attempts - a.attempts);
}
