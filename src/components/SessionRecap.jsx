import { formatClock } from "../lib/stats.js";
import { categoryLabel, pickTakeaways } from "../../lib/feedback.js";
import { recapHeadline } from "../lib/copy.js";
import Freddy from "./Freddy.jsx";
import { useTheme } from "./ThemeToggle.jsx";

export default function SessionRecap({ recap, recorded, onDone, onAgain, onPracticeVocab, onReview }) {
  const takeaways = pickTakeaways(recap.feedback);
  const keep = takeaways.correction || takeaways.tip;
  const { theme } = useTheme();
  const evening = theme === "soir";
  const frozen = (recap.transcript || []).filter((m) => m.text);
  const canReview = frozen.length > 0 || (recap.feedback || []).length > 0;
  const kicker = evening
    ? `Séance terminée · ${formatClock(recap.durationMs)}`
    : recap.daily
      ? `Séance du jour · ${formatClock(recap.durationMs)}`
      : `Séance terminée · ${formatClock(recap.durationMs)}`;

  return (
    <section className="recap-overlay">
      <div className="recap-frozen" aria-hidden="true">
        <div className="recap-frozen-title">{recap.scenarioTitle || "Pratique"}</div>
        {frozen.slice(-4).map((m) => (
          <div key={m.id} className={`recap-frozen-bubble ${m.who}`}>
            {m.text}
          </div>
        ))}
      </div>

      <div className="recap-sheet">
        <span className="recap-handle" />
        <div className="recap-hero">
          <div className="recap-mascot">
            <span className="recap-spark a" />
            <span className="recap-spark b" />
            <Freddy size="lg" />
          </div>
          <div>
            <p className="recap-kicker">{kicker}</p>
            <h2>{recapHeadline(recap, recorded)}</h2>
          </div>
        </div>

        <div className="recap-circles">
          <div className="recap-stat turns">
            <div>
              <span className="kpi-value">{recap.utterances || 0}</span>
              <span className="kpi-label">{recap.utterances === 1 ? "tour" : "tours"}</span>
            </div>
          </div>
          <div className="recap-stat words">
            <div>
              <span className="kpi-value">{recap.wordsSpoken || 0}</span>
              <span className="kpi-label">mots dits</span>
            </div>
          </div>
          <div className="recap-stat misses">
            <div>
              <span className="kpi-value">{recap.corrections || 0}</span>
              <span className="kpi-label">à revoir</span>
            </div>
          </div>
        </div>

        {keep && (
          <div className="keep-card">
            <div className="section-kicker">{evening ? "À réutiliser demain" : "À garder"}</div>
            {keep.corrected ? (
              <p>
                <span className="orig">{keep.errorPhrase || keep.original}</span>
                {" → "}
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
              {evening ? "Rejouer la scène" : "Encore une"}
            </button>
          )}
          {onReview && canReview && (
            <button className="btn-ghost-lg" type="button" onClick={onReview}>
              Relire
            </button>
          )}
          <button className={onReview && canReview ? "text-btn" : "btn-ghost-lg"} type="button" onClick={onDone}>
            {evening ? "Plus tard" : "Fermer"}
          </button>
        </div>
      </div>
    </section>
  );
}
