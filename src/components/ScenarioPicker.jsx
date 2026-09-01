import { useEffect, useState } from "react";
import { FOCUS_OPTIONS } from "../../lib/feedback.js";
import { pickDailyPlan } from "../lib/daily.js";
import StatsPanel from "./StatsPanel.jsx";

export default function ScenarioPicker({ onSelect, disabled, error, stats, onResetStats }) {
  const [scenarios, setScenarios] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [topic, setTopic] = useState("");
  const [focus, setFocus] = useState("");

  useEffect(() => {
    fetch("/api/scenarios")
      .then((res) => res.json())
      .then(setScenarios)
      .catch(() => setLoadError("Couldn't load scenarios. Refresh the page to try again."));
  }, []);

  return (
    <section id="picker-screen">
      <p className="hint">
        Each tap starts a slightly different scene — a new goal, a new name,
        sometimes a small snag. Corrections stay on the side so you can keep talking.
      </p>
      <label className="topic-field">
        <span>I want to talk about…</span>
        <input
          type="text"
          maxLength={200}
          placeholder="Optional — weekend plans, my job, a trip…"
          value={topic}
          disabled={disabled}
          onChange={(e) => setTopic(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="primary-btn daily-btn"
        disabled={disabled || scenarios.length === 0}
        onClick={() => {
          const plan = pickDailyPlan();
          const match = scenarios.find((s) => s.id === plan.scenarioId);
          onSelect(plan.scenarioId, match ? match.title : "Daily session", {
            topic: topic.trim(),
            focus: focus || plan.focus,
            daily: true,
          });
        }}
      >
        Today's 15 minutes
      </button>
      <div className="focus-row" role="group" aria-label="Grammar focus">
        {FOCUS_OPTIONS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`focus-chip${focus === f.id ? " selected" : ""}`}
            disabled={disabled}
            onClick={() => setFocus((cur) => (cur === f.id ? "" : f.id))}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="scenario-grid">
        {scenarios.map((s) => (
          <button
            key={s.id}
            className={`scenario-card${s.id === "surprise" ? " surprise" : ""}`}
            disabled={disabled}
            onClick={() => onSelect(s.id, s.title, { topic: topic.trim(), focus })}
          >
            <span className="scenario-title">{s.title}</span>
            {s.blurb && <span className="scenario-blurb">{s.blurb}</span>}
          </button>
        ))}
      </div>
      {(error || loadError) && <p className="error-banner">{error || loadError}</p>}
      <StatsPanel stats={stats} onReset={onResetStats} />
    </section>
  );
}
