import { useEffect, useState } from "react";
import { DAILY_MS } from "../lib/daily.js";
import { formatClock } from "../lib/stats.js";
import { categoryLabel } from "../../lib/feedback.js";
import TranscriptPanel from "./TranscriptPanel.jsx";
import CorrectionsPanel from "./CorrectionsPanel.jsx";
import Margot from "./Margot.jsx";
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
  handsFree,
  onHandsFree,
  onTalk,
  onEnd,
  onTimeUp,
  onRepeat,
}) {
  const elapsed = useElapsed(startedAt);
  const overTime = daily && elapsed >= DAILY_MS;
  const timerPct = daily ? Math.min(100, (elapsed / DAILY_MS) * 100) : 0;
  const { theme } = useTheme();
  const evening = theme === "soir";
  const connecting = status === "connecting";
  const reviewable = corrections.filter(
    (c) => c.isMajor || c.isMinor || c.verdict === "unclear" || c.tip
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [holding, setHolding] = useState(false);

  useEffect(() => {
    if (overTime && onTimeUp) onTimeUp();
  }, [overTime, onTimeUp]);

  function hold(on) {
    setHolding(on);
    if (onTalk) onTalk(on);
  }

  return (
    <section id="call-screen" className="call-screen talk-screen">
      <div className="call-topbar">
        <div className="call-identity">
          <Margot size="sm" />
          <h2>{scenarioTitle}</h2>
          {mission ? (
            <div className="mission-chip">
              <span className="mission-dot" />
              {mission}
              {focus ? <span className="mission-focus"> · {categoryLabel(focus)}</span> : null}
            </div>
          ) : focus ? (
            <div className="mission-chip">{categoryLabel(focus)}</div>
          ) : null}
        </div>
        <button type="button" className="end-btn" onClick={onEnd}>
          Terminer
        </button>
      </div>

      {overTime && (
        <p className="wrap-banner">15 minutes — tu peux conclure quand tu veux.</p>
      )}

      <div className="talk-body">
        <TranscriptPanel
          transcript={transcript}
          speaking={status === "speaking"}
          onRepeat={onRepeat}
        />
        {connecting && transcript.length === 0 && (
          <div className="bubble-row partner">
            <span className="partner-dot live" />
            <div className="typing" aria-label="Connexion">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        {reviewable.length > 0 && (
          <button
            type="button"
            className={`corrections-peek${drawerOpen ? " open" : ""}`}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <span className="live-count">{reviewable.length}</span>
            <span>À revoir</span>
          </button>
        )}
      </div>

      {drawerOpen && reviewable.length > 0 && (
        <div className="corrections-drawer">
          <CorrectionsPanel
            corrections={corrections}
            onRepeat={onRepeat}
            utterances={liveStats.utterances}
            misses={liveStats.corrections}
          />
        </div>
      )}

      <div className="talk-dock">
        <div className="timer-pill dock-timer">
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
        <button
          type="button"
          className={`talk-btn${holding ? " holding" : ""}${handsFree ? " live" : ""}`}
          disabled={connecting}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            hold(true);
          }}
          onPointerUp={() => hold(false)}
          onPointerCancel={() => hold(false)}
        >
          {connecting ? "Un instant…" : handsFree ? "Je t'écoute" : "Maintiens pour parler"}
          <span className="daily-bars" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </span>
        </button>
        <button
          type="button"
          className={`handsfree-hint${handsFree ? " on" : ""}`}
          onClick={() => onHandsFree && onHandsFree(!handsFree)}
        >
          {handsFree ? "mains libres" : evening ? "ou parle librement" : "ou parle librement — mains libres"}
        </button>
      </div>
    </section>
  );
}
