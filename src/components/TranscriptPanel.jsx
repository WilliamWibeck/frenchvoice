export default function TranscriptPanel({ transcript }) {
  return (
    <div className="panel transcript-panel">
      <h2>Conversation</h2>
      <div className="transcript">
        {transcript.length === 0 && <p className="empty-hint">Say something to get started…</p>}
        {transcript.map((m) => (
          <div key={m.id} className={`bubble ${m.who}`}>
            <span className="label">{m.who === "you" ? "You" : "Partner"}</span>
            <span>{m.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
