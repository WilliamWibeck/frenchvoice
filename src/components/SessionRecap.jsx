import { formatClock } from "../lib/stats.js";
import { categoryLabel, pickTakeaways } from "../../lib/feedback.js";
import { recapHeadline } from "../lib/copy.js";
import Margot from "./Margot.jsx";

export default function SessionRecap({ recap, recorded, onDone, onAgain, onPracticeVocab }) {
  const takeaways = pickTakeaways(recap.feedback);
  const keep = takeaways.correction || takeaways.tip;
  const kicker = recap.daily
    ? `Séance du jour${recap.scenarioTitle ? ` · ${recap.scenarioTitle}` : ""}`
    : recap.scenarioTitle || "Séance";

  return (
    <section className="recap-screen">
      <div className="recap-mascot">
        <span className="recap-spark a" />
        <span className="recap-spark b" />
        <Margot size="lg" />
      </div>
      <div>
        <p className="recap-kicker">{kicker}</p>
        <h2>{recapHeadline(recap, recorded)}</h2>
      </div>

      <div className="recap-circles">
        <div className="recap-stat">
          <div>
            <span className="kpi-value">{formatClock(recap.durationMs)}</span>
            <span className="kpi-label">temps</span>
          </div>
        </div>
        <div className="recap-stat">
          <div>
            <span className="kpi-value">{recap.utterances || 0}</span>
            <span className="kpi-label">{recap.utterances === 1 ? "tour" : "tours"}</span>
          </div>
        </div>
        <div className="recap-stat">
          <div>
            <span className="kpi-value">{recap.corrections || 0}</span>
            <span className="kpi-label">à revoir</span>
          </div>
        </div>
      </div>

      {keep && (
        <div className="keep-card">
          <div className="section-kicker">À garder</div>
          {keep.corrected ? (
            <p>
              <strong>{keep.corrected}</strong>
              {keep.explain ? ` — ${keep.explain}` : keep.category ? ` — ${categoryLabel(keep.category)}` : ""}
            </p>
          ) : keep.tip ? (
            <p>
              <strong>{keep.tip.fr}</strong>
              {keep.tip.en ? ` — ${keep.tip.en}` : ""}
            </p>
          ) : (
            <p>{keep.original}</p>
          )}
        </div>
      )}

      {(recap.vocab || []).length > 0 && (
        <div className="vocab-review">
          <div className="section-kicker">Mots à garder</div>
          <ul>
            {(recap.vocab || []).map((v) => (
              <li key={v.fr}>
                <strong>{v.fr}</strong>
                {v.en ? <span> — {v.en}</span> : null}
              </li>
            ))}
          </ul>
          {onPracticeVocab && (
            <button className="text-btn" type="button" onClick={() => onPracticeVocab(recap.vocab)}>
              Parler avec ces mots
            </button>
          )}
        </div>
      )}

      {!recorded && (
        <p className="empty-hint">Trop court pour la série — quelques tours de plus la prochaine fois.</p>
      )}

      <div className="recap-actions">
        {onAgain && (
          <button className="btn-primary-lg" type="button" onClick={onAgain}>
            Encore une
          </button>
        )}
        <button className="btn-ghost-lg" type="button" onClick={onDone}>
          Plus tard
        </button>
      </div>
    </section>
  );
}
