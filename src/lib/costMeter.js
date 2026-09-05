// Dev-only cost instrumentation for a Live API session.
//
// The Live API reports token usage in `usageMetadata` on server messages.
// We accumulate it here so we can answer two questions the pricing model
// depends on:
//
//   1. What does a real session actually cost per minute?
//   2. Is cost LINEAR in session length? If Gemini re-bills the accumulated
//      conversation history on every turn, prompt tokens per turn will climb
//      as the session runs, and long sessions cost far more than a linear
//      model predicts. `linearity` below is the test for that.
//
// Rates are per 1M tokens, from ai.google.dev/gemini-api/docs/pricing.

const RATES = {
  liveAudioIn: 3.0,
  liveAudioOut: 12.0,
  liveTextIn: 0.75,
  correctionIn: 0.25, // gemini-3.1-flash-lite
  correctionOut: 1.5,
};

// Live API bills audio at 25 tokens per second in each direction. Used to turn
// token counts back into "how many seconds did each side actually speak".
const TOKENS_PER_AUDIO_SECOND = 25;

function num(...vals) {
  for (const v of vals) if (typeof v === "number" && !Number.isNaN(v)) return v;
  return 0;
}

// The raw WebSocket protocol and the SDK disagree on casing, so read both.
function modalityTokens(details, modality) {
  if (!Array.isArray(details)) return 0;
  let total = 0;
  for (const d of details) {
    const m = String(d?.modality || d?.Modality || "").toUpperCase();
    if (m === modality) total += num(d?.tokenCount, d?.token_count);
  }
  return total;
}

export function createCostMeter() {
  const startedAt = Date.now();
  const samples = [];
  const corrections = { calls: 0, inTokens: 0, outTokens: 0 };
  let last = { prompt: 0, response: 0 };

  return {
    startedAt,

    // Call for every server message that carries usageMetadata.
    recordUsage(usage) {
      if (!usage) return;
      const prompt = num(usage.promptTokenCount, usage.prompt_token_count);
      const response = num(
        usage.responseTokenCount,
        usage.response_token_count,
        usage.candidatesTokenCount,
        usage.candidates_token_count
      );
      // Counts are cumulative across the session, so store the delta.
      const dPrompt = Math.max(0, prompt - last.prompt);
      const dResponse = Math.max(0, response - last.response);
      if (!dPrompt && !dResponse) return;
      last = { prompt, response };

      const pd = usage.promptTokensDetails || usage.prompt_tokens_details;
      const rd = usage.responseTokensDetails || usage.response_tokens_details;

      samples.push({
        at: Date.now() - startedAt,
        dPrompt,
        dResponse,
        promptAudio: modalityTokens(pd, "AUDIO"),
        promptText: modalityTokens(pd, "TEXT"),
        responseAudio: modalityTokens(rd, "AUDIO"),
        cumPrompt: prompt,
        cumResponse: response,
      });
    },

    recordCorrection(inTokens, outTokens) {
      corrections.calls += 1;
      corrections.inTokens += num(inTokens);
      corrections.outTokens += num(outTokens);
    },

    report(nowMs = Date.now()) {
      const durationMs = nowMs - startedAt;
      const minutes = durationMs / 60000;
      const n = samples.length;

      const cum = samples[n - 1] || { cumPrompt: 0, cumResponse: 0 };

      // Modality counts may be reported cumulatively (like the totals) or per
      // message. Non-decreasing across samples means cumulative — take the
      // final reading. Otherwise they are per-message deltas — sum them.
      // Summing cumulative values would inflate audio tokens several-fold.
      const resolve = (key) => {
        const vals = samples.map((x) => x[key]);
        if (!vals.length) return 0;
        const cumulative = vals.every((v, i) => i === 0 || v >= vals[i - 1]);
        return cumulative ? vals[vals.length - 1] : vals.reduce((a, b) => a + b, 0);
      };

      // Modality detail is not always present; fall back to totals.
      const promptAudio = resolve("promptAudio") || cum.cumPrompt;
      const promptText = resolve("promptText");
      const responseAudio = resolve("responseAudio") || cum.cumResponse;

      // THE test: does prompt cost per turn grow as the session runs?
      let linearity = null;
      if (n >= 6) {
        const third = Math.floor(n / 3);
        const head = samples.slice(0, third);
        const tail = samples.slice(n - third);
        const avg = (arr) => arr.reduce((s, x) => s + x.dPrompt, 0) / (arr.length || 1);
        const first = avg(head);
        const lastAvg = avg(tail);
        linearity = {
          firstThirdPerTurn: Math.round(first),
          lastThirdPerTurn: Math.round(lastAvg),
          ratio: first > 0 ? +(lastAvg / first).toFixed(2) : null,
        };
        linearity.verdict =
          linearity.ratio == null
            ? "inconclusive"
            : linearity.ratio < 1.35
              ? "LINEAR — model holds"
              : linearity.ratio < 2
                ? "MILDLY SUPERLINEAR — add headroom"
                : "RE-BILLED HISTORY — model is wrong, reprice";
      }

      const cost = {
        liveAudioIn: (promptAudio / 1e6) * RATES.liveAudioIn,
        liveAudioOut: (responseAudio / 1e6) * RATES.liveAudioOut,
        liveTextIn: (promptText / 1e6) * RATES.liveTextIn,
        corrections:
          (corrections.inTokens / 1e6) * RATES.correctionIn +
          (corrections.outTokens / 1e6) * RATES.correctionOut,
      };
      cost.total = cost.liveAudioIn + cost.liveAudioOut + cost.liveTextIn + cost.corrections;
      cost.perMinute = minutes > 0 ? cost.total / minutes : 0;

      // Turn token counts back into speaking time, to check the duty-cycle
      // assumptions the pricing model is built on.
      const margotSpokeSec = responseAudio / TOKENS_PER_AUDIO_SECOND;
      const learnerUploadedSec = promptAudio / TOKENS_PER_AUDIO_SECOND;
      const durationSec = durationMs / 1000;

      return {
        durationMs,
        minutes: +minutes.toFixed(2),
        usageMessages: n,
        tokens: { promptAudio, promptText, responseAudio },
        corrections: { ...corrections },
        dutyCycle: {
          margotSpeaking: durationSec ? +(margotSpokeSec / durationSec).toFixed(3) : null,
          learnerUploading: durationSec ? +(learnerUploadedSec / durationSec).toFixed(3) : null,
        },
        correctionsPerMinute: minutes > 0 ? +(corrections.calls / minutes).toFixed(2) : 0,
        linearity,
        cost,
        samples,
      };
    },
  };
}

const MODEL_ASSUMPTIONS = {
  margotSpeaking: 0.28,
  learnerUploading: 0.25,
  correctionsPerMinute: 4,
  perMinute: 0.011,
};

function pct(x) {
  return x == null ? "n/a" : (x * 100).toFixed(1) + "%";
}

function drift(actual, assumed) {
  if (actual == null || !assumed) return "";
  const r = actual / assumed;
  const tag = r > 1.25 ? "  ** OVER MODEL **" : r < 0.75 ? "  (under model)" : "";
  return `  [model ${typeof assumed === "number" && assumed < 1 ? pct(assumed) : assumed}]${tag}`;
}

export function printCostReport(r) {
  const usd = (n) => "$" + n.toFixed(4);
  const lines = [
    "",
    "======== SESSION COST REPORT ========",
    `duration        ${(r.durationMs / 1000).toFixed(0)}s (${r.minutes} min)`,
    `usage messages  ${r.usageMessages}`,
    "",
    "-- tokens --",
    `  prompt audio    ${r.tokens.promptAudio.toLocaleString()}`,
    `  prompt text     ${r.tokens.promptText.toLocaleString()}`,
    `  response audio  ${r.tokens.responseAudio.toLocaleString()}`,
    `  corrections     ${r.corrections.calls} calls, ${r.corrections.inTokens} in / ${r.corrections.outTokens} out`,
    "",
    "-- duty cycle (vs pricing model) --",
    `  Margot speaking    ${pct(r.dutyCycle.margotSpeaking)}${drift(r.dutyCycle.margotSpeaking, MODEL_ASSUMPTIONS.margotSpeaking)}`,
    `  learner uploading  ${pct(r.dutyCycle.learnerUploading)}${drift(r.dutyCycle.learnerUploading, MODEL_ASSUMPTIONS.learnerUploading)}`,
    `  corrections/min    ${r.correctionsPerMinute}${drift(r.correctionsPerMinute, MODEL_ASSUMPTIONS.correctionsPerMinute)}`,
    "",
    "-- linearity: is conversation history re-billed each turn? --",
  ];
  if (r.linearity) {
    lines.push(
      `  prompt tokens/turn, first third  ${r.linearity.firstThirdPerTurn}`,
      `  prompt tokens/turn, last third   ${r.linearity.lastThirdPerTurn}`,
      `  ratio                            ${r.linearity.ratio}`,
      `  VERDICT: ${r.linearity.verdict}`
    );
  } else {
    lines.push("  not enough turns — run a longer session (aim for 5+ minutes)");
  }
  lines.push(
    "",
    "-- cost --",
    `  live audio in   ${usd(r.cost.liveAudioIn)}`,
    `  live audio out  ${usd(r.cost.liveAudioOut)}`,
    `  live text in    ${usd(r.cost.liveTextIn)}`,
    `  corrections     ${usd(r.cost.corrections)}`,
    `  TOTAL           ${usd(r.cost.total)}`,
    `  PER MINUTE      ${usd(r.cost.perMinute)}   [model $0.0110]${
      r.cost.perMinute > MODEL_ASSUMPTIONS.perMinute * 1.25 ? "  ** OVER MODEL **" : ""
    }`,
    "====================================="
  );
  console.log(lines.join("\n"));
}
