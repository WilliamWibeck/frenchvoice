import { useCallback, useRef, useState } from "react";
import { startPcmCapture, createPcmPlayer } from "../lib/pcmAudio.js";
import { normalizeFeedback, collectVocab } from "../../lib/feedback.js";
import { createCostMeter, printCostReport } from "../lib/costMeter.js";

const STATUS_LABELS = {
  idle: "Idle",
  connecting: "Connecting…",
  listening: "Listening…",
  speaking: "Partner speaking…",
  ended: "Ended",
};

const LIVE_WS_PATH =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained";

export function useRealtimeSession() {
  const [status, setStatus] = useState("idle");
  const [scenarioTitle, setScenarioTitle] = useState("");
  const [scenarioId, setScenarioId] = useState("");
  const [mission, setMission] = useState("");
  const [focus, setFocus] = useState("");
  const [daily, setDaily] = useState(false);
  const [startedAt, setStartedAt] = useState(null);
  const [transcript, setTranscript] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [error, setError] = useState(null);
  const [liveStats, setLiveStats] = useState({ utterances: 0, wordsSpoken: 0, corrections: 0 });

  const sessionRef = useRef(null);
  const statsRef = useRef({
    scenarioId: "",
    scenarioTitle: "",
    mission: "",
    startedAt: 0,
    utterances: 0,
    wordsSpoken: 0,
    corrections: 0,
    lastTipAt: -99,
    feedback: [],
    turns: [],
    transcript: [],
  });
  const pendingChecksRef = useRef(new Set());
  const talkingRef = useRef(false);
  const handsFreeRef = useRef(true);
  const [handsFree, setHandsFreeState] = useState(() => {
    try {
      return localStorage.getItem("frenchvoice-handsfree") !== "off";
    } catch {
      return true;
    }
  });
  handsFreeRef.current = handsFree;

  const setTalking = useCallback((on) => {
    talkingRef.current = !!on;
  }, []);

  const setHandsFree = useCallback((on) => {
    const next = !!on;
    handsFreeRef.current = next;
    setHandsFreeState(next);
    try {
      localStorage.setItem("frenchvoice-handsfree", next ? "on" : "off");
    } catch {
      /* ignore */
    }
  }, []);

  const upsertTranscriptItem = useCallback((id, who, textOrUpdater) => {
    setTranscript((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      let next;
      if (idx === -1) {
        const text = typeof textOrUpdater === "function" ? textOrUpdater("") : textOrUpdater;
        next = [...prev, { id, who, text }];
      } else {
        next = [...prev];
        const current = next[idx];
        const text = typeof textOrUpdater === "function" ? textOrUpdater(current.text) : textOrUpdater;
        next[idx] = { ...current, text };
      }
      statsRef.current.transcript = next;
      return next;
    });
  }, []);

  const requestCorrectionCheck = useCallback((itemId, text) => {
    const requestStartedAt = statsRef.current.startedAt;
    const run = (async () => {
      try {
        const res = await fetch("/api/correct", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        const data = await res.json();
        if (statsRef.current.startedAt !== requestStartedAt) return;

        if (data.usage) {
          sessionRef.current?.costMeter?.recordCorrection(
            data.usage.inTokens,
            data.usage.outTokens
          );
        }

        let feedback = data.feedback;
        if (!feedback && data.correction) {
          feedback = normalizeFeedback({ correction: data.correction }, text);
        }
        if (!feedback) return;
        feedback = { ...feedback, id: `fb-${itemId}`, itemId };

        const sinceTip = statsRef.current.utterances - statsRef.current.lastTipAt;
        if (feedback.tip && (feedback.isMajor || sinceTip < 3)) {
          feedback = { ...feedback, tip: null };
        } else if (feedback.tip) {
          statsRef.current.lastTipAt = statsRef.current.utterances;
        }

        statsRef.current.feedback.push(feedback);
        statsRef.current.turns.push({
          itemId,
          verdict: feedback.verdict,
          severity: feedback.severity,
          category: feedback.category,
        });

        if (feedback.isMajor) {
          statsRef.current.corrections += 1;
        }

        const live = !sessionRef.current?.closed;
        if (live && feedback.isMajor) {
          setLiveStats((prev) => ({ ...prev, corrections: statsRef.current.corrections }));
        }

        const showInPanel = feedback.isMajor || feedback.isMinor || feedback.verdict === "unclear" || feedback.tip;
        if (live && showInPanel) {
          setCorrections((prev) => [...prev, feedback]);
        }

        if (live) {
          setTranscript((prev) => {
            const next = prev.map((m) => (m.id === itemId ? { ...m, feedback } : m));
            statsRef.current.transcript = next;
            return next;
          });
        }
      } catch (err) {
        console.error("Correction check failed:", err);
      }
    })();
    pendingChecksRef.current.add(run);
    run.finally(() => pendingChecksRef.current.delete(run));
  }, []);

  const snapshotRecap = useCallback(() => {
    const s = statsRef.current;
    const endedAt = Date.now();
    return {
      id: `session-${s.startedAt || endedAt}`,
      scenarioId: s.scenarioId,
      scenarioTitle: s.scenarioTitle,
      mission: s.mission,
      topic: s.topic || "",
      focus: s.focus || "",
      daily: !!s.daily,
      startedAt: s.startedAt || endedAt,
      endedAt,
      durationMs: s.startedAt ? endedAt - s.startedAt : 0,
      utterances: s.utterances,
      wordsSpoken: s.wordsSpoken,
      corrections: s.corrections,
      feedback: s.feedback || [],
      turns: s.turns || [],
      transcript: s.transcript || [],
      vocab: collectVocab(s.feedback || []),
    };
  }, []);

  const endCall = useCallback(async () => {
    const session = sessionRef.current;
    if (session?.endPromise) return session.endPromise;

    const run = (async () => {
      if (session) session.closed = true;

      if (session?.ws) {
        try { session.ws.close(); } catch {}
      }
      if (session?.capturer) {
        session.capturer.stop().catch(() => {});
      }
      if (session?.player) {
        session.player.destroy().catch(() => {});
      }
      if (session?.micStream) {
        session.micStream.getTracks().forEach((t) => t.stop());
      }

      finishUserTurn(session, statsRef, setLiveStats, requestCorrectionCheck);

      const pending = [...pendingChecksRef.current];
      if (pending.length) {
        await Promise.race([
          Promise.allSettled(pending),
          new Promise((resolve) => setTimeout(resolve, 2500)),
        ]);
      }

      if (session?.costMeter) {
        const costReport = session.costMeter.report();
        printCostReport(costReport);
        if (typeof window !== "undefined") {
          window.__lastCostReport = costReport;
          window.__costReports = [...(window.__costReports || []), costReport];
        }
      }

      sessionRef.current = session || { closed: true };
      setStatus("ended");
      const recap = snapshotRecap();
      if (session) session.recap = recap;
      else sessionRef.current.recap = recap;
      return recap;
    })();

    if (session) session.endPromise = run;
    return run;
  }, [snapshotRecap, requestCorrectionCheck]);

  const startCall = useCallback(
    async (scenarioId, title, options = {}) => {
      setError(null);
      setTranscript([]);
      setCorrections([]);
      setScenarioTitle(title);
      setScenarioId(scenarioId);
      setMission("");
      setFocus(options.focus || "");
      setDaily(!!options.daily);
      setStartedAt(null);
      setLiveStats({ utterances: 0, wordsSpoken: 0, corrections: 0 });
      pendingChecksRef.current = new Set();
      statsRef.current = {
        scenarioId,
        scenarioTitle: title,
        mission: "",
        topic: options.topic || "",
        focus: options.focus || "",
        daily: !!options.daily,
        startedAt: 0,
        utterances: 0,
        wordsSpoken: 0,
        corrections: 0,
        lastTipAt: -99,
        feedback: [],
        turns: [],
        transcript: [],
      };
      setStatus("connecting");

      let micStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch {
        setError("Microphone access is required to practice speaking. Please allow it and try again.");
        setStatus("idle");
        return false;
      }

      const player = createPcmPlayer();
      try {
        await player.resume();
      } catch {
        /* Autoplay lock — playBase64Pcm16 will try again. */
      }

      const session = {
        closed: false,
        costMeter: createCostMeter(),
        ws: null,
        micStream,
        capturer: null,
        player,
        userTurnId: null,
        partnerTurnId: null,
        userText: "",
        partnerText: "",
        nextYou: 0,
        nextPartner: 0,
        allowMic: false,
        shouldSend: () => handsFreeRef.current || talkingRef.current,
      };
      sessionRef.current = session;

      try {
        const tokenRes = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            scenario: scenarioId,
            topic: options.topic || "",
            focus: options.focus || "",
            daily: !!options.daily,
            resume: !!options.resume,
            vocabTargets: options.vocabTargets || [],
          }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) throw new Error(tokenData.error || "Failed to get session token");
        const ephemeralKey = tokenData.value;
        const model = tokenData.model || "gemini-3.1-flash-live-preview";
        const voice = tokenData.voice || "Kore";
        const instructions = tokenData.instructions || "";
        if (!ephemeralKey) throw new Error("Session token was empty");

        const resolvedTitle = tokenData.scenarioTitle || title;
        const resolvedId = tokenData.scenarioId || scenarioId;
        const resolvedMission = tokenData.mission || "";
        setScenarioTitle(resolvedTitle);
        setScenarioId(resolvedId);
        setMission(resolvedMission);
        const started = Date.now();
        setStartedAt(started);
        statsRef.current.scenarioId = resolvedId;
        statsRef.current.scenarioTitle = resolvedTitle;
        statsRef.current.mission = resolvedMission;
        statsRef.current.topic = options.topic || "";
        statsRef.current.focus = options.focus || "";
        statsRef.current.daily = !!options.daily;
        statsRef.current.startedAt = started;

        const ws = new WebSocket(
          `${LIVE_WS_PATH}?access_token=${encodeURIComponent(ephemeralKey)}`
        );
        session.ws = ws;

        const sendJson = (payload) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
        };
        session.sendJson = sendJson;

        let settled = false;
        const ready = new Promise((resolve, reject) => {
          const finish = (ok, err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            session.markReady = null;
            session.markFailed = null;
            if (ok) resolve();
            else reject(err);
          };
          const timer = setTimeout(() => {
            finish(false, new Error("La session vocale n'a pas démarré."));
          }, 15000);
          session.markReady = () => finish(true);
          session.markFailed = (err) =>
            finish(false, err instanceof Error ? err : new Error(String(err)));
        });

        ws.addEventListener("open", () => {
          sendJson({
            setup: {
              model: `models/${model}`,
              generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voice },
                  },
                  languageCode: "fr-FR",
                },
              },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              ...(instructions
                ? { systemInstruction: { parts: [{ text: instructions }] } }
                : {}),
            },
          });
        });

        ws.addEventListener("message", async (event) => {
          if (session.closed) return;
          let raw = event.data;
          try {
            if (raw instanceof Blob) raw = await raw.text();
            else if (raw instanceof ArrayBuffer) raw = new TextDecoder().decode(raw);
            const message = JSON.parse(raw);
            handleLiveMessage(
              message,
              session,
              sendJson,
              setStatus,
              upsertTranscriptItem,
              requestCorrectionCheck,
              statsRef,
              setLiveStats
            );
          } catch (err) {
            console.error("Failed to parse Live API message:", err);
          }
        });

        await new Promise((resolve, reject) => {
          const onError = () => reject(new Error("Failed to connect to Gemini Live"));
          ws.addEventListener("open", resolve, { once: true });
          ws.addEventListener("error", onError, { once: true });
        });

        if (session.closed) return false;

        ws.addEventListener("close", (ev) => {
          if (session.closed) return;
          session.closed = true;
          const reason = ev?.reason || "connexion fermée";
          if (session.markFailed) {
            session.markFailed(new Error(`La voix s'est coupée (${reason}).`));
          }
          setStatus("ended");
        });

        await ready;
        if (session.closed) return false;
        return true;
      } catch (err) {
        console.error(err);
        setError(err.message || String(err));
        setStatus("ended");
        await endCall();
        return false;
      }
    },
    [upsertTranscriptItem, requestCorrectionCheck, endCall]
  );

  const promptWrapUp = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.closed || session.wrapSent || !session.sendJson) return;
    session.wrapSent = true;
    sendRealtimeText(
      session.sendJson,
      "The practice window is ending. Start wrapping up the conversation warmly in French. Do not mention a timer or English."
    );
  }, []);

  const promptRepeat = useCallback((phrase) => {
    const session = sessionRef.current;
    const text = typeof phrase === "string" ? phrase.trim() : "";
    if (!session || session.closed || !session.sendJson || !text) return;
    sendRealtimeText(
      session.sendJson,
      `The learner will now repeat this phrase: "${text}". Listen, give a brief encouraging acknowledgment in French, then continue the scenario. Do not switch to English.`
    );
  }, []);

  return {
    status,
    statusLabel: STATUS_LABELS[status] || status,
    scenarioTitle,
    scenarioId,
    mission,
    focus,
    daily,
    startedAt,
    liveStats,
    transcript,
    corrections,
    error,
    startCall,
    endCall,
    promptWrapUp,
    promptRepeat,
    handsFree,
    setHandsFree,
    setTalking,
  };
}

function sendRealtimeText(sendJson, text) {
  sendJson({ realtimeInput: { text } });
}

function pick(obj, ...keys) {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] != null) return obj[key];
  }
  return undefined;
}

function handleLiveMessage(
  message,
  session,
  sendJson,
  setStatus,
  upsertTranscriptItem,
  requestCorrectionCheck,
  statsRef,
  setLiveStats
) {
  const usage = pick(message, "usageMetadata", "usage_metadata");
  if (usage) {
    session.costMeter?.recordUsage(usage);
  }

  if (pick(message, "setupComplete", "setup_complete")) {
    startMicAndGreeting(session, sendJson, setStatus).catch((err) => {
      console.error(err);
      session.markFailed?.(err);
    });
    return;
  }

  const content = pick(message, "serverContent", "server_content");
  if (!content) {
    const err = pick(message, "error");
    if (err) {
      console.error("Gemini Live error:", err);
      const text = err.message || err.status || JSON.stringify(err);
      session.markFailed?.(new Error(text));
    }
    return;
  }

  const modelTurn = pick(content, "modelTurn", "model_turn");
  const parts = modelTurn && modelTurn.parts;
  if (parts) {
    for (const part of parts) {
      const inline = pick(part, "inlineData", "inline_data");
      const data = inline && pick(inline, "data");
      if (data && session.player) {
        session.allowMic = true;
        finishUserTurn(session, statsRef, setLiveStats, requestCorrectionCheck);
        session.player.playBase64Pcm16(data);
        setStatus("speaking");
      }
    }
  }

  const inputTranscription = pick(content, "inputTranscription", "input_transcription");
  if (inputTranscription) {
    const chunk = inputTranscription.text || "";
    if (chunk) {
      if (!session.userTurnId) {
        session.userTurnId = `you-${session.nextYou++}`;
        session.userText = "";
      }
      session.userText += chunk;
      upsertTranscriptItem(session.userTurnId, "you", session.userText);
      setStatus("listening");
    }
    if (inputTranscription.finished) {
      finishUserTurn(session, statsRef, setLiveStats, requestCorrectionCheck);
    }
  }

  const outputTranscription = pick(content, "outputTranscription", "output_transcription");
  if (outputTranscription && outputTranscription.text) {
    session.allowMic = true;
    finishUserTurn(session, statsRef, setLiveStats, requestCorrectionCheck);
    const chunk = outputTranscription.text;
    if (!session.partnerTurnId) {
      session.partnerTurnId = `partner-${session.nextPartner++}`;
      session.partnerText = "";
    }
    session.partnerText += chunk;
    upsertTranscriptItem(session.partnerTurnId, "partner", session.partnerText);
    setStatus("speaking");
  }

  if (content.interrupted) {
    if (session.player) session.player.interrupt();
    setStatus("listening");
  }

  if (pick(content, "turnComplete", "turn_complete", "generationComplete", "generation_complete")) {
    finishUserTurn(session, statsRef, setLiveStats, requestCorrectionCheck);
    session.partnerTurnId = null;
    session.partnerText = "";
    setStatus("listening");
  }
}

function finishUserTurn(session, statsRef, setLiveStats, requestCorrectionCheck) {
  if (!session) return;
  const spoken = (session.userText || "").trim();
  const itemId = session.userTurnId;
  session.userTurnId = null;
  session.userText = "";
  if (!itemId || !spoken) return;
  const words = spoken.split(/\s+/).filter(Boolean).length;
  statsRef.current.utterances += 1;
  statsRef.current.wordsSpoken += words;
  setLiveStats({
    utterances: statsRef.current.utterances,
    wordsSpoken: statsRef.current.wordsSpoken,
    corrections: statsRef.current.corrections,
  });
  requestCorrectionCheck(itemId, spoken);
}

async function startMicAndGreeting(session, sendJson, setStatus) {
  if (session.closed || session.capturer) {
    session.markReady?.();
    return;
  }
  sendRealtimeText(
    sendJson,
    "The learner just joined. Speak first now: greet them in French and begin the scenario. Do not wait for them to talk."
  );
  setStatus("listening");
  session.markReady?.();

  try {
    session.capturer = await startPcmCapture(session.micStream, (b64) => {
      if (session.closed) return;
      if (!session.allowMic) return;
      if (!session.shouldSend || !session.shouldSend()) return;
      sendJson({
        realtimeInput: {
          audio: {
            mimeType: "audio/pcm;rate=16000",
            data: b64,
          },
        },
      });
    });
  } catch (err) {
    console.error(err);
  }
  window.setTimeout(() => {
    session.allowMic = true;
  }, 1200);
}
