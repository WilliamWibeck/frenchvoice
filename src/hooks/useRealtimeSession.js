import { useCallback, useRef, useState } from "react";
import { startPcmCapture, createPcmPlayer } from "../lib/pcmAudio.js";
import { normalizeFeedback } from "../../lib/feedback.js";

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
  });

  const upsertTranscriptItem = useCallback((id, who, textOrUpdater) => {
    setTranscript((prev) => {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx === -1) {
        const text = typeof textOrUpdater === "function" ? textOrUpdater("") : textOrUpdater;
        return [...prev, { id, who, text }];
      }
      const next = [...prev];
      const current = next[idx];
      const text = typeof textOrUpdater === "function" ? textOrUpdater(current.text) : textOrUpdater;
      next[idx] = { ...current, text };
      return next;
    });
  }, []);

  const requestCorrectionCheck = useCallback(async (itemId, text) => {
    try {
      const res = await fetch("/api/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!sessionRef.current || sessionRef.current.closed) return;

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
        setLiveStats((prev) => ({ ...prev, corrections: statsRef.current.corrections }));
      }

      const showInPanel = feedback.isMajor || feedback.isMinor || feedback.verdict === "unclear" || feedback.tip;
      if (showInPanel) {
        setCorrections((prev) => [...prev, feedback]);
      }

      setTranscript((prev) =>
        prev.map((m) => (m.id === itemId ? { ...m, feedback } : m))
      );
    } catch (err) {
      console.error("Correction check failed:", err);
    }
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
    };
  }, []);

  const endCall = useCallback(() => {
    const session = sessionRef.current;
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
    sessionRef.current = session || { closed: true };
    setStatus("ended");
    return snapshotRecap();
  }, [snapshotRecap]);

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

      const session = {
        closed: false,
        ws: null,
        micStream,
        capturer: null,
        player: null,
        userTurnId: null,
        partnerTurnId: null,
        userText: "",
        partnerText: "",
        nextYou: 0,
        nextPartner: 0,
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

        const player = createPcmPlayer();
        session.player = player;

        const ws = new WebSocket(
          `${LIVE_WS_PATH}?access_token=${encodeURIComponent(ephemeralKey)}`
        );
        session.ws = ws;

        const sendJson = (payload) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(payload));
        };
        session.sendJson = sendJson;

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

        ws.addEventListener("close", () => {
          if (!session.closed) {
            session.closed = true;
            setStatus("ended");
          }
        });

        return true;
      } catch (err) {
        console.error(err);
        setError(err.message || String(err));
        setStatus("ended");
        endCall();
        return false;
      }
    },
    [upsertTranscriptItem, requestCorrectionCheck, endCall]
  );

  const promptWrapUp = useCallback(() => {
    const session = sessionRef.current;
    if (!session || session.closed || session.wrapSent || !session.sendJson) return;
    session.wrapSent = true;
    session.sendJson({
      clientContent: {
        turns: [
          {
            role: "user",
            parts: [
              {
                text: "The practice window is ending. Start wrapping up the conversation warmly in French. Do not mention a timer or English.",
              },
            ],
          },
        ],
        turnComplete: true,
      },
    });
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
  };
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
  if (message.setupComplete) {
    startMicAndGreeting(session, sendJson, setStatus).catch((err) => {
      console.error(err);
    });
    return;
  }

  const content = message.serverContent;
  if (!content) {
    if (message.error) console.error("Gemini Live error:", message.error);
    return;
  }

  const parts = content.modelTurn && content.modelTurn.parts;
  if (parts) {
    for (const part of parts) {
      if (part.inlineData && part.inlineData.data && session.player) {
        session.player.playBase64Pcm16(part.inlineData.data);
        setStatus("speaking");
      }
    }
  }

  if (content.inputTranscription && content.inputTranscription.text) {
    const chunk = content.inputTranscription.text;
    const finished = !!content.inputTranscription.finished;
    if (!session.userTurnId) {
      session.userTurnId = `you-${session.nextYou++}`;
      session.userText = "";
    }
    session.userText += chunk;
    upsertTranscriptItem(session.userTurnId, "you", session.userText);
    setStatus("listening");
    if (finished) {
      const spoken = session.userText.trim();
      const itemId = session.userTurnId;
      session.userTurnId = null;
      session.userText = "";
      if (spoken) {
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
    }
  }

  if (content.outputTranscription && content.outputTranscription.text) {
    const chunk = content.outputTranscription.text;
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

  if (content.turnComplete) {
    session.partnerTurnId = null;
    session.partnerText = "";
    setStatus("listening");
  }
}

async function startMicAndGreeting(session, sendJson, setStatus) {
  if (session.closed || session.capturer) return;
  session.capturer = await startPcmCapture(session.micStream, (b64) => {
    if (session.closed) return;
    sendJson({
      realtimeInput: {
        audio: {
          mimeType: "audio/pcm;rate=16000",
          data: b64,
        },
      },
    });
  });
  sendJson({
    clientContent: {
      turns: [
        {
          role: "user",
          parts: [{ text: "The learner just joined. Greet them now and begin the scenario." }],
        },
      ],
      turnComplete: true,
    },
  });
  setStatus("listening");
}
