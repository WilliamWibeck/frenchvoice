export default function CorrectionsPanel({ corrections }) {
  return (
    <div className="panel corrections-panel">
      <h2>Corrections &amp; feedback</h2>
      <div className="corrections">
        {corrections.length === 0 && (
          <p className="empty-hint">Corrections will appear here as you speak. No news is good news.</p>
        )}
        {corrections.map((c) => (
          <div key={c.id} className="correction-item">
            {c.text}
          </div>
        ))}
      </div>
    </div>
  );
}
