import { categoryLabel } from "../../lib/feedback.js";

function FeedbackCard({ item, onRepeat }) {
  if (item.verdict === "unclear") {
    return (
      <div className="correction-item unclear">
        <span className="fb-kicker">Might have misheard</span>
        <p>{item.original}</p>
        <p className="fb-explain">I did not treat this as a grammar mistake.</p>
      </div>
    );
  }

  return (
    <div className={`correction-item ${item.isMajor ? "major" : item.isMinor ? "minor" : "tip-only"}`}>
      {item.category ? (
        <span className="fb-kicker">{categoryLabel(item.category)}</span>
      ) : item.tip ? (
        <span className="fb-kicker">Tip</span>
      ) : null}
      {item.corrected && (
        <p>
          <span className="orig">{item.original}</span>
          {" → "}
          <span className="fixed">{item.corrected}</span>
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
          Say it again
        </button>
      )}
    </div>
  );
}

export default function CorrectionsPanel({ corrections, onRepeat }) {
  const visible = corrections.filter(
    (c) => c.isMajor || c.isMinor || c.verdict === "unclear" || c.tip
  );

  return (
    <div className="panel corrections-panel">
      <h2>Corrections &amp; tips</h2>
      <div className="corrections">
        {visible.length === 0 && (
          <p className="empty-hint">
            Real mistakes show up here after you speak. Tips appear only now and then.
          </p>
        )}
        {visible.map((c) => (
          <FeedbackCard key={c.id} item={c} onRepeat={onRepeat} />
        ))}
      </div>
    </div>
  );
}
