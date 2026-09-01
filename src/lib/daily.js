import { FOCUS_OPTIONS } from "../../lib/feedback.js";
import { localDateKey } from "./stats.js";

export const DAILY_MINUTES = 15;
export const DAILY_MS = DAILY_MINUTES * 60 * 1000;

const ROTATION = ["cafe", "free", "boulangerie", "smalltalk", "hotel", "directions"];

export function pickDailyPlan(now = Date.now()) {
  const n = Number(localDateKey(now).replace(/-/g, ""));
  return {
    scenarioId: ROTATION[n % ROTATION.length],
    focus: FOCUS_OPTIONS[n % FOCUS_OPTIONS.length].id,
    minutes: DAILY_MINUTES,
  };
}
