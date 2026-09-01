import { accuracyPct, formatClock, formatMinutes } from "../lib/stats.js";

export default function SessionRecap({ recap, recorded, onDone }) {
  const acc = accuracyPct(recap.utterances, recap.corrections);

  return (
    <section className="recap-screen">
      <p className="recap-kicker">{recorded ? "Session saved" : "Short session"}</p>
      <h2>{recap.scenarioTitle}</h2>
      {recap.mission && <p className="recap-mission">{recap.mission}</p>}

      <div className="recap-grid">
        <div className="recap-stat">
          <span className="kpi-value">{formatClock(recap.durationMs)}</span>
          <span className="kpi-label">time</span>
        </div>
        <div className="recap-stat">
          <span className="kpi-value">{recap.utterances}</span>
          <span className="kpi-label">{recap.utterances === 1 ? "turn" : "turns"}</span>
        </div>
        <div className="recap-stat">
          <span className="kpi-value">{recap.corrections}</span>
          <span className="kpi-label">{recap.corrections === 1 ? "correction" : "corrections"}</span>
        </div>
        <div className="recap-stat">
          <span className="kpi-value">{acc == null ? "—" : `${acc}%`}</span>
          <span className="kpi-label">accuracy</span>
        </div>
      </div>

      {recap.wordsSpoken > 0 && (
        <p className="recap-words">{recap.wordsSpoken} words spoken · {formatMinutes(recap.durationMs)}</p>
      )}
      {!recorded && (
        <p className="empty-hint">Too short to count toward your streak — try a few more turns next time.</p>
      )}

      <button className="primary-btn" onClick={onDone}>
        Back to scenarios
      </button>
    </section>
  );
}
