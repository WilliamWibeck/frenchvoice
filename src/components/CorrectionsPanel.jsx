import { categoryLabel } from "../../lib/feedback.js";
import { useTheme } from "./ThemeToggle.jsx";

function FeedbackCard({ item, onRepeat }) {
  if (item.verdict === "unclear") {
    return (
      <div className="correction-item unclear">
        <div className="fb-kicker">Peut-être mal entendu</div>
        <p>{item.original}</p>
        <p className="fb-explain">Je n'ai pas traité ça comme une faute.</p>
      </div>
    );
  }

  const kind = item.isMajor ? "major" : item.isMinor ? "minor" : "tip-only";
  return (
    <div className={`correction-item ${kind}`}>
      {item.category ? (
        <div className="fb-kicker">{categoryLabel(item.category)}</div>
      ) : item.tip ? (
        <div className="fb-kicker">À réutiliser</div>
      ) : null}
      {item.corrected && (
        <p>
          <span className="orig">{item.errorPhrase || item.original}</span>
          {" → "}
          <strong className="fixed">{item.corrected}</strong>
        </p>
      )}
      {item.explain && <p className="fb-explain">{item.explain}</p>}
      {item.tip && (
        <p className="fb-tip">
          <strong>{item.tip.fr}</strong>
          {item.tip.en ? <span> — {item.tip.en}</span> : null}
        </p>
      )}
      {item.corrected && onRepeat && (
        <button type="button" className="repeat-btn" onClick={() => onRepeat(item.corrected)}>
          Redis-le
        </button>
      )}
    </div>
  );
}

export default function CorrectionsPanel({ corrections, onRepeat, utterances = 0, misses = 0 }) {
  const { theme } = useTheme();
  const visible = corrections.filter(
    (c) => c.isMajor || c.isMinor || c.verdict === "unclear" || c.tip
  );

  return (
    <aside className="margin-col">
      <div className="section-kicker">{theme === "soir" ? "Corrections" : "Dans la marge"}</div>
      {visible.map((c) => (
        <FeedbackCard key={c.id} item={c} onRepeat={onRepeat} />
      ))}
      <div className="call-live-meta">
        <span className="live-count">{utterances}</span>
        tours · {misses} {misses === 1 ? "correction" : "corrections"}
      </div>
    </aside>
  );
}
