import { formatClock, formatSessionDate, hydrateTranscript } from "../lib/stats.js";
import { categoryLabel } from "../../lib/feedback.js";
import TranscriptPanel from "./TranscriptPanel.jsx";
import CorrectionsPanel from "./CorrectionsPanel.jsx";
import Freddy from "./Freddy.jsx";
import { useTheme } from "./ThemeToggle.jsx";

export default function ConversationReview({ session, onDone }) {
  const { theme } = useTheme();
  const evening = theme === "soir";
  const transcript = hydrateTranscript(session);
  const corrections = (session.feedback || []).filter(
    (c) => c.isMajor || c.isMinor || c.verdict === "unclear" || c.tip
  );
  const when = formatSessionDate(session.startedAt);
  const length = formatClock(session.durationMs);

  return (
    <section className="call-screen talk-screen review-screen">
      <div className="call-topbar">
        <div className="call-identity">
          <Freddy size="sm" />
          <h2>{session.scenarioTitle || "Conversation"}</h2>
          <div className="mission-chip">
            <span className="mission-dot" />
            {evening ? "Lecture" : "Lecture seule"}
            {when ? ` · ${when}` : ""}
            {length ? ` · ${length}` : ""}
            {session.focus ? ` · ${categoryLabel(session.focus)}` : ""}
          </div>
        </div>
        <button type="button" className="end-btn" onClick={onDone}>
          Fermer
        </button>
      </div>

      <div className="call-body review-body">
        <div>
          {transcript.length > 0 ? (
            <TranscriptPanel transcript={transcript} speaking={false} />
          ) : (
            <p className="review-empty">Pas de transcript pour cette séance.</p>
          )}
        </div>
        {corrections.length > 0 ? (
          <CorrectionsPanel
            corrections={corrections}
            utterances={session.utterances || 0}
            misses={session.corrections || 0}
          />
        ) : (
          <aside className="margin-col">
            <div className="section-kicker">{evening ? "Corrections" : "Dans la marge"}</div>
            <p className="review-empty">Rien à revoir — c'était fluide.</p>
          </aside>
        )}
      </div>
    </section>
  );
}
