import { useEffect, useState } from "react";
import { FOCUS_OPTIONS } from "../../lib/feedback.js";
import { pickDailyPlan } from "../lib/daily.js";
import { pickWeakFocus } from "../lib/weakpoints.js";
import { recentVocab, summarizeStats } from "../lib/stats.js";
import StatsPanel from "./StatsPanel.jsx";
import Margot from "./Margot.jsx";
import { useTheme } from "./ThemeToggle.jsx";

export default function ScenarioPicker({ onSelect, disabled, error, stats, onResetStats }) {
  const [scenarios, setScenarios] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [topic, setTopic] = useState("");
  const [focus, setFocus] = useState("");

  useEffect(() => {
    fetch("/api/scenarios")
      .then((res) => res.json())
      .then(setScenarios)
      .catch(() => setLoadError("Impossible de charger les scènes. Rafraîchis la page."));
  }, []);

  const weak = pickWeakFocus(stats);
  const words = recentVocab(stats);
  const customTopic = topic.trim();
  const summary = summarizeStats(stats);
  const { theme } = useTheme();
  const evening = theme === "soir";

  function startDaily() {
    if (disabled) return;
    if (!customTopic && scenarios.length === 0) return;
    const plan = pickDailyPlan();
    const scenarioId = customTopic ? "free" : plan.scenarioId;
    const match = scenarios.find((s) => s.id === scenarioId);
    onSelect(scenarioId, customTopic || (match ? match.title : "Daily session"), {
      topic: customTopic,
      focus: focus || pickWeakFocus(stats)?.id || plan.focus,
      daily: true,
    });
  }

  return (
    <section id="picker-screen" className="screen-card">
      <div className="picker-top">
        <h1 className="brand">Pratique orale</h1>
        {evening ? (
          <span className="soir-meta">
            {new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} · A1–A2
          </span>
        ) : summary.streak > 0 ? (
          <span className="streak-pill">
            <span className="streak-dot" />
            {summary.streak} {summary.streak === 1 ? "jour" : "jours"}
          </span>
        ) : null}
      </div>

      <div className="margot-hello">
        <span className="hello-glow" aria-hidden="true" />
        <Margot size="md" />
        <p className="speech">
          <span className="speech-title">
            {evening ? "Bonsoir ! Tu as cinq minutes ?" : "Salut ! On parle de quoi aujourd'hui ?"}
          </span>
          {evening && <span className="speech-sub">Margot a une nouvelle scène pour toi.</span>}
        </p>
      </div>

      <form
        className="daily-start"
        onSubmit={(e) => {
          e.preventDefault();
          startDaily();
        }}
      >
        <label className="topic-field">
          <span>I want to talk about…</span>
          <input
            className="input"
            type="text"
            maxLength={200}
            placeholder="Weekend plans, my job, a trip…"
            value={topic}
            disabled={disabled}
            onChange={(e) => setTopic(e.target.value)}
          />
        </label>
        <button
          type="submit"
          className="daily-btn"
          disabled={disabled || (!customTopic && scenarios.length === 0)}
        >
          Aujourd'hui : 15 minutes
          <span className="daily-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span className="daily-arrow" aria-hidden="true">→</span>
        </button>
      </form>

      {words.length >= 3 && (
        <p>
          <button
            type="button"
            className="text-btn"
            disabled={disabled}
            onClick={() => onSelect("free", "Discussion libre", { vocabTargets: words })}
          >
            Revoir mes mots
          </button>
        </p>
      )}
      {weak && (
        <p className="weak-banner">
          Margot suggère : {weak.label} ({weak.accuracy}% sur {weak.attempts} essais).
          <button type="button" className="text-btn inline" onClick={() => setFocus(weak.id)}>
            Utiliser
          </button>
        </p>
      )}
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
        {scenarios.map((s, i) => (
          <button
            key={s.id}
            className={`scenario-card${s.id === "surprise" ? " surprise" : i % 2 ? " sage" : ""}`}
            disabled={disabled}
            onClick={() => onSelect(s.id, s.title, { topic: topic.trim(), focus })}
          >
            <span className="scenario-blob" />
            <span className="scenario-index">
              {s.id === "surprise" ? "?" : String(i + 1).padStart(2, "0")}
            </span>
            <span className="scenario-copy">
              <span className="scenario-title">{s.title}</span>
              {s.blurb && <span className="scenario-blurb">{s.blurb}</span>}
            </span>
          </button>
        ))}
      </div>
      {(error || loadError) && <p className="error-banner">{error || loadError}</p>}
      <StatsPanel stats={stats} onReset={onResetStats} />
    </section>
  );
}
