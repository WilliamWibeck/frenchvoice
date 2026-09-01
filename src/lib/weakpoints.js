import { categoryProgress } from "./stats.js";

const MIN_ATTEMPTS = 6;
const STRONG = 85;

export function pickWeakFocus(stats, minAttempts = MIN_ATTEMPTS) {
  const rows = categoryProgress(stats).filter((row) => row.attempts >= minAttempts);
  if (!rows.length) return null;
  rows.sort((a, b) => (a.accuracy ?? 100) - (b.accuracy ?? 100) || b.attempts - a.attempts);
  const worst = rows[0];
  if (worst.accuracy == null || worst.accuracy >= STRONG) return null;
  return worst;
}
