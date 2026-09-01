import { useEffect, useState } from "react";
import StatsPanel from "./StatsPanel.jsx";

export default function ScenarioPicker({ onSelect, disabled, error, stats, onResetStats }) {
  const [scenarios, setScenarios] = useState([]);
  const [loadError, setLoadError] = useState(null);

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
      <div className="scenario-grid">
        {scenarios.map((s) => (
          <button
            key={s.id}
            className={`scenario-card${s.id === "surprise" ? " surprise" : ""}`}
            disabled={disabled}
            onClick={() => onSelect(s.id, s.title)}
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
