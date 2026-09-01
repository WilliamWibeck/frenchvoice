import { accuracyPct, formatClock, formatMinutes } from "../lib/stats.js";
import { categoryLabel, pickTakeaways } from "../../lib/feedback.js";
import SessionSparkline from "./SessionSparkline.jsx";

export default function SessionRecap({ recap, recorded, onDone }) {
  const acc = accuracyPct(recap.utterances, recap.corrections);
  const takeaways = pickTakeaways(recap.feedback);
  const saved = (recap.feedback || []).filter(
    (i) => i.isMajor || i.isMinor || i.verdict === "unclear" || i.tip
  );

  return (
    <section className="recap-screen">
      <p className="recap-kicker">
        {recap.daily ? "Daily session" : recorded ? "Session saved" : "Short session"}
      </p>
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
          <span className="kpi-label">{recap.corrections === 1 ? "major miss" : "major misses"}</span>
        </div>
        <div className="recap-stat">
          <span className="kpi-value">{acc == null ? "—" : `${acc}%`}</span>
          <span className="kpi-label">accuracy</span>
        </div>
      </div>

      <SessionSparkline turns={recap.turns} />

      {(takeaways.correction || takeaways.tip || takeaways.keep) && (
        <div className="takeaways">
          <h3>Takeaways</h3>
          {takeaways.correction && (
            <div className="takeaway-card">
              <span className="mission-label">
                {takeaways.correction.category
                  ? categoryLabel(takeaways.correction.category)
                  : "Correction"}
              </span>
              <p>
                <span className="orig">{takeaways.correction.original}</span>
                {takeaways.correction.corrected ? (
                  <>
                    {" → "}
                    <span className="fixed">{takeaways.correction.corrected}</span>
                  </>
                ) : null}
              </p>
              {takeaways.correction.explain && (
                <p className="fb-explain">{takeaways.correction.explain}</p>
              )}
            </div>
          )}
          {takeaways.tip && (
            <div className="takeaway-card tip">
              <span className="mission-label">Phrase to reuse</span>
              <p>
                <strong>{takeaways.tip.tip.fr}</strong>
                {takeaways.tip.tip.en ? ` — ${takeaways.tip.tip.en}` : ""}
              </p>
            </div>
          )}
          {takeaways.keep && (
            <div className="takeaway-card keep">
              <span className="mission-label">This worked</span>
              <p>{takeaways.keep.original}</p>
            </div>
          )}
        </div>
      )}

      {saved.length > 0 && (
        <div className="recap-errors">
          <h3>This session</h3>
          {saved.map((item) => (
            <div key={item.id} className="recap-error-row">
              {item.isMajor || item.isMinor ? (
                <span>
                  {item.corrected || item.original}
                  {item.category ? ` · ${categoryLabel(item.category)}` : ""}
                </span>
              ) : item.tip ? (
                <span>{item.tip.fr}</span>
              ) : (
                <span>Unclear transcript</span>
              )}
            </div>
          ))}
        </div>
      )}

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
