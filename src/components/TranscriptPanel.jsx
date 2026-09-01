function HighlightedUtterance({ text, feedback }) {
  const span = feedback && feedback.span;
  if (!text) return null;
  if (!span || span.start < 0 || span.end <= span.start || span.end > text.length) {
    return <span>{text}</span>;
  }
  const markClass = feedback.isMajor || feedback.isMinor ? "err-span" : "unclear-span";
  return (
    <span>
      {text.slice(0, span.start)}
      <mark className={markClass}>{text.slice(span.start, span.end)}</mark>
      {text.slice(span.end)}
    </span>
  );
}

export default function TranscriptPanel({ transcript }) {
  return (
    <div className="panel transcript-panel">
      <h2>Conversation</h2>
      <div className="transcript">
        {transcript.length === 0 && <p className="empty-hint">Say something to get started…</p>}
        {transcript.map((m) => {
          const fb = m.feedback;
          const bubbleClass = [
            "bubble",
            m.who,
            fb?.isMajor ? "has-error" : "",
            fb?.verdict === "ok" ? "is-ok" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div key={m.id} className={bubbleClass}>
              <span className="label">{m.who === "you" ? "You" : "Partner"}</span>
              {m.who === "you" && fb ? (
                <HighlightedUtterance text={m.text} feedback={fb} />
              ) : (
                <span>{m.text}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
