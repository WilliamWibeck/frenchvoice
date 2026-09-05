import { useState } from "react";
import ScenarioPicker from "./components/ScenarioPicker.jsx";
import CallScreen from "./components/CallScreen.jsx";
import SessionRecap from "./components/SessionRecap.jsx";
import ConversationReview from "./components/ConversationReview.jsx";
import ThemeToggle from "./components/ThemeToggle.jsx";
import { useRealtimeSession } from "./hooks/useRealtimeSession.js";
import { saveResume } from "./lib/resume.js";
import { loadStats, recordSession, resetStats, shouldRecord } from "./lib/stats.js";

export default function App() {
  const [inCall, setInCall] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [stats, setStats] = useState(loadStats);
  const [recap, setRecap] = useState(null);
  const [recapRecorded, setRecapRecorded] = useState(false);
  const [review, setReview] = useState(null);
  const session = useRealtimeSession();

  async function handleSelect(scenarioId, title, options = {}) {
    setRecap(null);
    setReview(null);
    setConnecting(true);
    const ok = await session.startCall(scenarioId, title, options);
    setConnecting(false);
    if (ok) setInCall(true);
  }

  async function handleEnd() {
    const snapshot = await session.endCall();
    setInCall(false);
    if (!snapshot) {
      setRecap(null);
      return;
    }
    const recorded = shouldRecord(snapshot);
    if (recorded) {
      setStats(recordSession(snapshot));
      saveResume({
        scenarioId: snapshot.scenarioId,
        title: snapshot.scenarioTitle,
        mission: snapshot.mission,
        focus: snapshot.focus,
        daily: snapshot.daily,
        topic: snapshot.topic,
        customPrompt: snapshot.customPrompt,
        customTitle: snapshot.customTitle || snapshot.scenarioTitle,
      });
    }
    setRecapRecorded(recorded);
    setRecap(snapshot);
  }

  function handleResetStats() {
    if (!window.confirm("Effacer toutes les stats sur cet appareil ?")) return;
    setStats(resetStats());
  }

  return (
    <div className="app-shell">
      <ThemeToggle />
      {inCall ? (
        <CallScreen
          scenarioTitle={session.scenarioTitle}
          mission={session.mission}
          focus={session.focus}
          daily={session.daily}
          status={session.status}
          statusLabel={session.statusLabel}
          startedAt={session.startedAt}
          liveStats={session.liveStats}
          transcript={session.transcript}
          corrections={session.corrections}
          handsFree={session.handsFree}
          onHandsFree={session.setHandsFree}
          onTalk={session.setTalking}
          onEnd={handleEnd}
          onTimeUp={session.promptWrapUp}
          onRepeat={session.promptRepeat}
        />
      ) : recap ? (
        <SessionRecap
          recap={recap}
          recorded={recapRecorded}
          onDone={() => setRecap(null)}
          onReview={() => {
            setReview(recap);
            setRecap(null);
          }}
          onAgain={() =>
            handleSelect(recap.scenarioId, recap.scenarioTitle, {
              topic: recap.topic || "",
              focus: recap.focus || "",
              daily: !!recap.daily,
              customPrompt: recap.customPrompt || "",
              customTitle: recap.customTitle || recap.scenarioTitle,
            })
          }
          onPracticeVocab={(words) => {
            setRecap(null);
            handleSelect("free", "Discussion libre", { vocabTargets: words });
          }}
        />
      ) : review ? (
        <ConversationReview session={review} onDone={() => setReview(null)} />
      ) : (
        <ScenarioPicker
          onSelect={handleSelect}
          disabled={connecting}
          error={session.error}
          stats={stats}
          onResetStats={handleResetStats}
          onOpenSession={setReview}
        />
      )}
    </div>
  );
}

