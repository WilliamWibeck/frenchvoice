import { useState } from "react";
import ScenarioPicker from "./components/ScenarioPicker.jsx";
import CallScreen from "./components/CallScreen.jsx";
import SessionRecap from "./components/SessionRecap.jsx";
import { useRealtimeSession } from "./hooks/useRealtimeSession.js";
import { loadStats, recordSession, resetStats, shouldRecord } from "./lib/stats.js";

export default function App() {
  const [inCall, setInCall] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [stats, setStats] = useState(loadStats);
  const [recap, setRecap] = useState(null);
  const [recapRecorded, setRecapRecorded] = useState(false);
  const session = useRealtimeSession();

  async function handleSelect(scenarioId, title, options = {}) {
    setRecap(null);
    setConnecting(true);
    const ok = await session.startCall(scenarioId, title, options);
    setConnecting(false);
    if (ok) setInCall(true);
  }

  function handleEnd() {
    const snapshot = session.endCall();
    setInCall(false);
    if (!snapshot) {
      setRecap(null);
      return;
    }
    const recorded = shouldRecord(snapshot);
    if (recorded) setStats(recordSession(snapshot));
    setRecapRecorded(recorded);
    setRecap(snapshot);
  }

  function handleResetStats() {
    if (!window.confirm("Clear all practice stats on this device?")) return;
    setStats(resetStats());
  }

  return (
    <>
      <header className="app-header">
        <h1>🇫🇷 Pratique orale</h1>
        <p className="subtitle">Voice-to-voice French practice · Level: A1–A2 (beginner)</p>
      </header>

      <main>
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
            onEnd={handleEnd}
            onTimeUp={session.promptWrapUp}
            onRepeat={session.promptRepeat}
          />
        ) : recap ? (
          <SessionRecap
            recap={recap}
            recorded={recapRecorded}
            onDone={() => setRecap(null)}
            onPracticeVocab={(words) => {
              setRecap(null);
              handleSelect("free", "Discussion libre", { vocabTargets: words });
            }}
          />
        ) : (
          <ScenarioPicker
            onSelect={handleSelect}
            disabled={connecting}
            error={session.error}
            stats={stats}
            onResetStats={handleResetStats}
          />
        )}
      </main>
    </>
  );
}
