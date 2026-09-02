import { useEffect, useState } from "react";
import { DAILY_MS } from "../lib/daily.js";
import { formatClock } from "../lib/stats.js";
import { categoryLabel } from "../../lib/feedback.js";
import TranscriptPanel from "./TranscriptPanel.jsx";
import CorrectionsPanel from "./CorrectionsPanel.jsx";
import Margot from "./Margot.jsx";
import VoiceOrb from "./VoiceOrb.jsx";
import { useTheme } from "./ThemeToggle.jsx";

function useElapsed(startedAt) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!startedAt) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);
  return startedAt ? now - startedAt : 0;
}

export default function CallScreen({
  scenarioTitle,
  mission,
  focus,
  daily,
  status,
  startedAt,
  liveStats,
  transcript,
  corrections,
  onEnd,
  onTimeUp,
  onRepeat,
}) {
  const elapsed = useElapsed(startedAt);
  const overTime = daily && elapsed >= DAILY_MS;
  const listeningFirst = transcript.length === 0;
  const timerPct = daily ? Math.min(100, (elapsed / DAILY_MS) * 100) : 0;
  const { theme } = useTheme();
  const evening = theme === "soir";

  useEffect(() => {
    if (overTime && onTimeUp) onTimeUp();
  }, [overTime, onTimeUp]);

  if (listeningFirst) {
    const connecting = status === "connecting";
    return (
      <section className="listen-screen">
        <div className="listen-kicker">
          {scenarioTitle || "Pratique"} · {connecting ? "connexion" : evening ? "en direct" : "j'écoute"}
        </div>
        <VoiceOrb active={!connecting} />
        <div className="listen-copy">
          <h2>{connecting ? "Un instant…" : evening ? "Je t'écoute" : "Vas-y, je t'écoute"}</h2>
          <p>
            {connecting
              ? "Margot s'installe."
              : evening
                ? "Prends ton temps. Les corrections attendent la fin du tour."
                : "Parle normalement — je te corrige après."}
          </p>
        </div>
        <div className="waiting-chip">
          <span className="waiting-avatar" />
          {evening && mission
            ? `Objectif : ${mission}`
            : "Margot attend ta réponse"}
          {!evening && (
            <span className="dot-wave" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          )}
        </div>
        <button type="button" className="listen-end" onClick={onEnd}>
          Terminer
        </button>
      </section>
    );
  }

  return (
    <section id="call-screen" className="call-screen">
      <div className="call-topbar">
        <div className="call-identity">
          <Margot size="sm" />
          <div>
            <h2>{scenarioTitle}</h2>
            <div className="call-sub">
              {evening
                ? `${mission ? `Objectif : ${mission} · ` : ""}${focus ? categoryLabel(focus) : "avec Margot"}`
                : `avec Margot${focus ? ` · ${categoryLabel(focus)}` : ""}`}
            </div>
          </div>
        </div>
        <div className="call-tools">
          <div className="timer-pill">
            <span
              className="timer-ring"
              style={{
                background: `conic-gradient(var(--color-accent) 0 ${timerPct}%, var(--color-neutral-300) 0)`,
              }}
            >
              <span />
            </span>
            {formatClock(elapsed)}
            {daily ? <span className="timer-muted"> / 15:00</span> : null}
          </div>
          <div className="timer-bar" aria-hidden="true">
            <span style={{ width: `${daily ? timerPct : 8}%` }} />
          </div>
          <button type="button" className="end-btn" onClick={onEnd}>
            Terminer
          </button>
        </div>
      </div>

      {mission && (
        <div className="mission-banner">
          <span className="mission-num">1</span>
          <div>
            <div className="mission-label">Ton objectif</div>
            <p>{mission}</p>
          </div>
        </div>
      )}

      {overTime && (
        <p className="wrap-banner">15 minutes — tu peux conclure quand tu veux.</p>
      )}

      <div className="call-body">
        <TranscriptPanel transcript={transcript} speaking={status === "speaking"} />
        <CorrectionsPanel
          corrections={corrections}
          onRepeat={onRepeat}
          utterances={liveStats.utterances}
          misses={liveStats.corrections}
        />
      </div>
    </section>
  );
}
