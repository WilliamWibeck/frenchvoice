import { useEffect, useState } from "react";
import { accuracyPct, formatClock } from "../lib/stats.js";
import { categoryLabel } from "../../lib/feedback.js";
import TranscriptPanel from "./TranscriptPanel.jsx";
import CorrectionsPanel from "./CorrectionsPanel.jsx";

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
  status,
  statusLabel,
  startedAt,
  liveStats,
  transcript,
  corrections,
  onEnd,
}) {
  const elapsed = useElapsed(startedAt);
  const acc = accuracyPct(liveStats.utterances, liveStats.corrections);

  return (
    <section id="call-screen">
      <div className="call-topbar">
        <div>
          <strong>{scenarioTitle}</strong>
          <span className={`status-pill status-${status}`}>{statusLabel}</span>
        </div>
        <button className="danger-btn" onClick={onEnd}>
          End conversation
        </button>
      </div>

      {(mission || focus) && (
        <div className="mission-banner">
          <span className="mission-label">Your goal</span>
          <span>{mission}</span>
          {focus ? <span className="focus-note">Focus: {categoryLabel(focus)}</span> : null}
        </div>
      )}

      <div className="call-meta">
        <span>{formatClock(elapsed)}</span>
        <span>{liveStats.utterances} {liveStats.utterances === 1 ? "turn" : "turns"}</span>
        <span>{liveStats.corrections} {liveStats.corrections === 1 ? "correction" : "corrections"}</span>
        {acc != null && <span>{acc}% this session</span>}
      </div>

      <div className="call-body">
        <TranscriptPanel transcript={transcript} />
        <CorrectionsPanel corrections={corrections} />
      </div>
    </section>
  );
}
