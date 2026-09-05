import { useEffect, useState } from "react";
import { FOCUS_OPTIONS } from "../../lib/feedback.js";
import { pickDailyPlan } from "../lib/daily.js";
import { pickWeakFocus } from "../lib/weakpoints.js";
import { localDateKey, recentVocab, summarizeStats } from "../lib/stats.js";
import { loadResume } from "../lib/resume.js";
import StatsPanel from "./StatsPanel.jsx";
import Margot from "./Margot.jsx";
import { useTheme } from "./ThemeToggle.jsx";

export default function ScenarioPicker({ onSelect, disabled, error, stats, onResetStats }) {
  const [scenarios, setScenarios] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [topic, setTopic] = useState("");
  const [focus, setFocus] = useState("");
  const [pickedWords, setPickedWords] = useState([]);
  const [resume] = useState(loadResume);
  const [scenesOpen, setScenesOpen] = useState(() => !loadResume());

  useEffect(() => {
    fetch("/api/scenarios")
      .then((res) => res.json())
      .then(setScenarios)
      .catch(() => setLoadError("Impossible de charger les scènes. Rafraîchis la page."));
  }, []);

  const weak = pickWeakFocus(stats);
  const words = recentVocab(stats, 4);
  const customTopic = topic.trim();
  const summary = summarizeStats(stats);
  const { theme } = useTheme();
  const evening = theme === "soir";
  const todayKey = localDateKey(Date.now());
  const usedToday = new Set();
  for (const session of stats?.sessions || []) {
    if (localDateKey(session.startedAt) !== todayKey) continue;
    for (const v of session.vocab || []) {
      if (v.fr) usedToday.add(v.fr.trim().toLowerCase());
    }
  }
  const usedCount = words.filter((w) => usedToday.has(w.fr.toLowerCase())).length;
  const surprise = scenarios.find((s) => s.id === "surprise");
  const listed = scenarios.filter((s) => s.id !== "surprise");
  const vocabTargets = pickedWords.length ? pickedWords : undefined;

  function extras(more = {}) {
    return {
      topic: customTopic,
      focus,
      vocabTargets,
      ...more,
    };
  }

  function startDaily() {
    if (disabled) return;
    if (!customTopic && scenarios.length === 0) return;
    const plan = pickDailyPlan();
    const scenarioId = customTopic ? "free" : plan.scenarioId;
    const match = scenarios.find((s) => s.id === scenarioId);
    onSelect(scenarioId, customTopic || (match ? match.title : "Daily session"), extras({
      focus: focus || weak?.id || plan.focus,
      daily: true,
    }));
  }

  function continueScene(fresh) {
    if (!resume || disabled) return;
    const id = resume.scenarioId === "surprise" ? "free" : resume.scenarioId;
    onSelect(id, resume.title, extras({
      topic: resume.topic || customTopic,
      focus: resume.focus || focus,
      daily: !!resume.daily,
      resume: !fresh,
    }));
  }

  function toggleWord(word) {
    const key = word.fr.toLowerCase();
    setPickedWords((cur) =>
      cur.some((item) => item.fr.toLowerCase() === key)
        ? cur.filter((item) => item.fr.toLowerCase() !== key)
        : [...cur, word]
    );
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

      {resume ? (
        <div className="continue-card">
          <div className="continue-hero">
            <Margot size="sm" />
            <div>
              <div className="continue-kicker">On reprend</div>
              <div className="continue-title">{resume.title}</div>
              <div className="continue-note">
                {resume.mission
                  ? `Objectif : ${resume.mission}`
                  : "Tu étais en pleine conversation."}
              </div>
            </div>
          </div>
          <div className="continue-actions">
            <button type="button" className="daily-btn continue-go" disabled={disabled} onClick={() => continueScene(false)}>
              Continuer
              <span className="daily-bars" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
            </button>
            <button type="button" className="btn-ghost-lg continue-fresh" disabled={disabled} onClick={() => continueScene(true)}>
              Depuis le début
            </button>
          </div>
        </div>
      ) : (
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
      )}

      {surprise && (
        <button
          type="button"
          className="surprise-banner"
          disabled={disabled}
          onClick={() => onSelect("surprise", surprise.title, extras())}
        >
          <span className="surprise-blob" aria-hidden="true" />
          <span className="scenario-index">?</span>
          <span className="scenario-copy">
            <span className="scenario-title">Surprise-moi</span>
            <span className="scenario-blurb">Une scène inédite, 15 minutes</span>
          </span>
        </button>
      )}

      {words.length > 0 && (
        <div className="word-bank">
          <div className="word-bank-top">
            <span className="section-kicker">Essaie ces mots aujourd'hui</span>
            <span className="word-bank-count">
              {usedCount} / {words.length}
            </span>
          </div>
          <div className="word-bank-row">
            {words.map((w) => {
              const used = usedToday.has(w.fr.toLowerCase());
              const picked = pickedWords.some((item) => item.fr.toLowerCase() === w.fr.toLowerCase());
              return (
                <button
                  key={w.fr}
                  type="button"
                  className={`word-chip${used ? " used" : ""}${picked ? " picked" : ""}`}
                  disabled={disabled}
                  aria-pressed={picked}
                  onClick={() => toggleWord(w)}
                >
                  {used ? <span className="word-tick">✓</span> : null}
                  {w.fr}
                </button>
              );
            })}
          </div>
          {pickedWords.length > 0 && (
            <button
              type="button"
              className="text-btn"
              disabled={disabled}
              onClick={() => onSelect("free", "Discussion libre", extras({ vocabTargets: pickedWords }))}
            >
              Parler avec ces mots
            </button>
          )}
        </div>
      )}

      <div className="word-bank focus-bank">
        <div className="word-bank-top">
          <span className="section-kicker">Un point à travailler</span>
          {focus ? (
            <button type="button" className="text-btn" onClick={() => setFocus("")}>
              Laisser faire
            </button>
          ) : (
            <span className="word-bank-count">optionnel</span>
          )}
        </div>
        {weak && (
          <p className="focus-hint">
            {focus === weak.id
              ? `Margot insistera sur le ${weak.label.toLowerCase()}.`
              : `Margot verrait bien le ${weak.label.toLowerCase()}.`}
          </p>
        )}
        <div className="word-bank-row" role="group" aria-label="Point de grammaire">
          {FOCUS_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`word-chip${focus === f.id ? " picked" : ""}${weak?.id === f.id && focus !== f.id ? " suggested" : ""}`}
              disabled={disabled}
              aria-pressed={focus === f.id}
              onClick={() => setFocus((cur) => (cur === f.id ? "" : f.id))}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        className="scenes-toggle"
        onClick={() => setScenesOpen((open) => !open)}
      >
        <span>
          Toutes les scènes <span className="scenes-count">({scenarios.length})</span>
        </span>
        <span className="scenes-caret">{scenesOpen ? "▴" : "▾"}</span>
      </button>

      {scenesOpen && (
        <div className="scenes-panel">
          <div className="scenario-grid">
            {listed.map((s, i) => (
              <button
                key={s.id}
                className={`scenario-card${i % 2 ? " sage" : ""}`}
                disabled={disabled}
                onClick={() => onSelect(s.id, s.title, extras())}
              >
                <span className="scenario-blob" />
                <span className="scenario-index">{String(i + 1).padStart(2, "0")}</span>
                <span className="scenario-copy">
                  <span className="scenario-title">{s.title}</span>
                  {s.blurb && <span className="scenario-blurb">{s.blurb}</span>}
                </span>
              </button>
            ))}
          </div>
          <form
            className="daily-start"
            onSubmit={(e) => {
              e.preventDefault();
              startDaily();
            }}
          >
            <label className="topic-field">
              <span>Je voudrais parler de…</span>
              <input
                className="input"
                type="text"
                maxLength={200}
                placeholder="le week-end, mon travail, un voyage…"
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
          <StatsPanel stats={stats} onReset={onResetStats} />
        </div>
      )}

      {(error || loadError) && <p className="error-banner">{error || loadError}</p>}
    </section>
  );
}
