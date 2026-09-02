function HighlightedUtterance({ text, feedback }) {
  const span = feedback && feedback.span;
  if (!text) return null;
  if (!span || span.start < 0 || span.end <= span.start || span.end > text.length) {
    return text;
  }
  const markClass = feedback.isMajor
    ? "err-span major"
    : feedback.isMinor
      ? "err-span minor"
      : "unclear-span";
  return (
    <>
      {text.slice(0, span.start)}
      <mark className={markClass}>{text.slice(span.start, span.end)}</mark>
      {text.slice(span.end)}
    </>
  );
}

function VerdictMark({ feedback }) {
  if (!feedback) return null;
  if (feedback.verdict === "ok") return <span className="verdict-mark ok">✓ nickel</span>;
  if (feedback.isMajor || feedback.isMinor) return null;
  if (feedback.verdict === "unclear") return <span className="verdict-mark unclear">?</span>;
  return null;
}

function bubbleClassName(message) {
  const fb = message.feedback;
  return [
    "bubble",
    message.who,
    fb?.isMajor ? "has-error" : "",
    fb?.isMinor ? "has-minor" : "",
    fb?.verdict === "ok" ? "is-ok" : "",
    fb?.verdict === "unclear" ? "is-unclear" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export default function TranscriptPanel({ transcript, speaking, onRepeat }) {
  return (
    <div className="transcript">
      {transcript.map((m) => {
        const fb = m.feedback;
        const corrected = fb?.corrected;
        return (
          <div key={m.id} className={`bubble-stack ${m.who}`}>
            <div className={`bubble-row ${m.who}`}>
              {m.who === "partner" ? <span className="partner-dot" /> : null}
              <div className={bubbleClassName(m)}>
                {m.who === "you" && fb ? (
                  <HighlightedUtterance text={m.text} feedback={fb} />
                ) : (
                  m.text
                )}
                {m.who === "you" ? <VerdictMark feedback={fb} /> : null}
              </div>
            </div>
            {m.who === "you" && corrected && onRepeat ? (
              <div className="bubble-actions">
                <button type="button" className="play-fix" onClick={() => onRepeat(corrected)}>
                  ▶ la bonne version
                </button>
              </div>
            ) : null}
          </div>
        );
      })}
      {speaking && (
        <div className="bubble-row partner">
          <span className="partner-dot live" />
          <div className="typing" aria-label="Margot is speaking">
            <i />
            <i />
            <i />
          </div>
        </div>
      )}
    </div>
  );
}
