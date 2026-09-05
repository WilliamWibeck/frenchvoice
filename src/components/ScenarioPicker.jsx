import { useEffect, useState } from "react";
import { FOCUS_OPTIONS } from "../../lib/feedback.js";
import { pickDailyPlan } from "../lib/daily.js";
import { pickWeakFocus } from "../lib/weakpoints.js";
import { localDateKey, recentVocab, summarizeStats, formatMinutes, formatSessionDate, reviewableSessions } from "../lib/stats.js";
import { loadResume } from "../lib/resume.js";
import { pickRotatingScenes } from "../lib/rotation.js";
import {
  findCustomScene,
  isCustomSceneId,
  isStarred,
  loadSavedScenes,
  removeCustomScene,
  saveCustomScene,
  toggleStar,
} from "../lib/savedScenes.js";
import StatsPanel from "./StatsPanel.jsx";
import Freddy from "./Freddy.jsx";
import { useTheme } from "./ThemeToggle.jsx";

function StarBtn({ on, disabled, onToggle }) {
  return (
    <button
      type="button"
      className={`star-btn${on ? " on" : ""}`}
      disabled={disabled}
      aria-pressed={on}
      aria-label={on ? "Retirer des scènes gardées" : "Garder cette scène"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3.4l2.47 5.01 5.53.8-4 3.9.94 5.5L12 16.05 7.06 18.61l.94-5.5-4-3.9 5.53-.8L12 3.4z"
          fill={on ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function SceneCard({ scene, index, starred, disabled, onPlay, onStar, onRemove }) {
  return (
    <div className={`scenario-card${index % 2 ? " sage" : ""}${disabled ? " is-disabled" : ""}`}>
      <button type="button" className="scenario-play" disabled={disabled} onClick={onPlay}>
        <span className="scenario-blob" />
        <span className="scenario-index">{String(index + 1).padStart(2, "0")}</span>
        <span className="scenario-copy">
          <span className="scenario-title">{scene.title}</span>
          {scene.blurb && <span className="scenario-blurb">{scene.blurb}</span>}
        </span>
      </button>
      {onRemove ? (
        <button
          type="button"
          className="scene-remove"
          disabled={disabled}
          aria-label="Supprimer cette scène"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
        >
          ×
        </button>
      ) : (
        <StarBtn on={starred} disabled={disabled} onToggle={onStar} />
      )}
    </div>
  );
}

function Accordion({ title, count, open, onToggle, children }) {
  return (
    <>
      <button type="button" className="scenes-toggle" onClick={onToggle} aria-expanded={open}>
        <span>
          {title} {count != null && <span className="scenes-count">({count})</span>}
        </span>
        <span className="scenes-caret">{open ? "▴" : "▾"}</span>
      </button>
      {open && <div className="scenes-panel">{children}</div>}
    </>
  );
}

export default function ScenarioPicker({ onSelect, disabled, error, stats, onResetStats, onOpenSession }) {
  const [scenarios, setScenarios] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [topic, setTopic] = useState("");
  const [focus, setFocus] = useState("");
  const [pickedWords, setPickedWords] = useState([]);
  const [resume] = useState(loadResume);
  const [scenesOpen, setScenesOpen] = useState(true);
  const [savedOpen, setSavedOpen] = useState(true);
  const [convosOpen, setConvosOpen] = useState(true);
  const [saved, setSaved] = useState(loadSavedScenes);
  const [sceneDraft, setSceneDraft] = useState("");

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
  const catalog = scenarios.filter((s) => s.id !== "surprise");
  const rotating = pickRotatingScenes(catalog);
  const kept = saved.starred
    .map((id) => catalog.find((s) => s.id === id))
    .filter(Boolean);
  const mine = [
    ...kept,
    ...saved.custom.map((s) => ({
      ...s,
      blurb: s.prompt.length > 72 ? `${s.prompt.slice(0, 71)}…` : s.prompt,
    })),
  ];
  const conversations = reviewableSessions(stats);
  const vocabTargets = pickedWords.length ? pickedWords : undefined;

  function extras(more = {}) {
    return {
      topic: customTopic,
      focus,
      vocabTargets,
      ...more,
    };
  }

  function playScene(scene, more = {}) {
    if (isCustomSceneId(scene.id)) {
      onSelect(scene.id, scene.title, extras({
        topic: "",
        customPrompt: scene.prompt,
        customTitle: scene.title,
        ...more,
      }));
      return;
    }
    onSelect(scene.id, scene.title, extras(more));
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
    const custom = isCustomSceneId(resume.scenarioId)
      ? findCustomScene(resume.scenarioId, saved)
      : null;
    onSelect(resume.scenarioId, resume.title, extras({
      topic: resume.topic || customTopic,
      focus: resume.focus || focus,
      daily: !!resume.daily,
      resume: !fresh,
      customPrompt: resume.customPrompt || custom?.prompt || "",
      customTitle: resume.customTitle || resume.title,
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

  function handleStar(id) {
    setSaved(toggleStar(id));
  }

  function handleCreateScene(event) {
    event.preventDefault();
    if (disabled) return;
    const { scene } = saveCustomScene({ prompt: sceneDraft });
    if (!scene) return;
    setSaved(loadSavedScenes());
    setSceneDraft("");
    playScene(scene);
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
            <Freddy size="sm" />
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
        <div className="freddy-hello">
          <span className="hello-glow" aria-hidden="true" />
          <Freddy size="md" />
          <p className="speech">
            <span className="speech-title">
              {evening ? "Bonsoir ! Tu as cinq minutes ?" : "Salut ! On parle de quoi aujourd'hui ?"}
            </span>
            {evening && <span className="speech-sub">Freddy a une nouvelle scène pour toi.</span>}
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
              ? `Freddy insistera sur le ${weak.label.toLowerCase()}.`
              : `Freddy verrait bien le ${weak.label.toLowerCase()}.`}
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

      {mine.length > 0 && (
        <Accordion
          title="Mes scènes"
          count={mine.length}
          open={savedOpen}
          onToggle={() => setSavedOpen((open) => !open)}
        >
          <div className="scenario-grid">
            {mine.map((s, i) => (
              <SceneCard
                key={s.id}
                scene={s}
                index={i}
                starred={isStarred(s.id, saved)}
                disabled={disabled}
                onPlay={() => playScene(s)}
                onStar={() => handleStar(s.id)}
                onRemove={isCustomSceneId(s.id) ? () => setSaved(removeCustomScene(s.id)) : undefined}
              />
            ))}
          </div>
        </Accordion>
      )}

      {conversations.length > 0 && onOpenSession && (
        <Accordion
          title="Conversations"
          count={conversations.length}
          open={convosOpen}
          onToggle={() => setConvosOpen((open) => !open)}
        >
          <div className="convo-list">
            {conversations.map((s) => {
              const n = s.corrections || 0;
              const when = formatSessionDate(s.startedAt);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="recent-item convo-item"
                  onClick={() => onOpenSession(s)}
                >
                  <span className="convo-copy">
                    <strong>{s.scenarioTitle || "Conversation"}</strong>
                    <span className="convo-sub">
                      {when}
                      {when ? " · " : ""}
                      {n === 1 ? "1 à revoir" : `${n} à revoir`}
                    </span>
                  </span>
                  <span className="recent-meta">{formatMinutes(s.durationMs)}</span>
                </button>
              );
            })}
          </div>
        </Accordion>
      )}

      <Accordion
        title="Les scènes"
        count={rotating.length || catalog.length}
        open={scenesOpen}
        onToggle={() => setScenesOpen((open) => !open)}
      >
          <div className="section-kicker scenes-kicker">Aujourd'hui</div>
          <div className="scenario-grid">
            {rotating.map((s, i) => (
              <SceneCard
                key={s.id}
                scene={s}
                index={i}
                starred={isStarred(s.id, saved)}
                disabled={disabled}
                onPlay={() => playScene(s)}
                onStar={() => handleStar(s.id)}
              />
            ))}
          </div>

          <form className="scene-compose" onSubmit={handleCreateScene}>
            <label className="topic-field">
              <span>Inventer une scène</span>
              <textarea
                className="input"
                rows={3}
                maxLength={500}
                placeholder="À la poste pour envoyer un colis, le guichetier est pressé…"
                value={sceneDraft}
                disabled={disabled}
                onChange={(e) => setSceneDraft(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="btn-ghost-lg compose-go"
              disabled={disabled || !sceneDraft.trim()}
            >
              Enregistrer et parler
            </button>
          </form>

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
      </Accordion>

      {(error || loadError) && <p className="error-banner">{error || loadError}</p>}
    </section>
  );
}
