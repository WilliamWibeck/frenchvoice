import { accuracyPct, formatMinutes, localDateKey, summarizeStats } from "../lib/stats.js";
import { frenchDayLabel, streakAside, streakHeadline } from "../lib/copy.js";

export default function StatsPanel({ stats, onReset }) {
  const summary = summarizeStats(stats);
  const todayKey = localDateKey(Date.now());
  const ringPct = Math.min(100, (summary.streak % 7) * (100 / 7) || (summary.streak ? 100 : 0));

  return (
    <section className="stats-panel" aria-label="Practice stats">
      <div className="streak-hero">
        <div className="streak-ring">
          <div
            className="streak-ring-fill"
            style={{
              background: `conic-gradient(var(--color-accent) 0 ${ringPct}%, var(--color-accent-200) 0)`,
            }}
          />
          <div className="streak-ring-inner">{summary.streak}</div>
        </div>
        <div className="streak-copy">
          <h2>{streakHeadline(summary.streak)}</h2>
          <p>{streakAside(summary.streak)}</p>
        </div>
      </div>

      <div className="week-dots" aria-label="Last 7 days">
        {summary.week.map((d) => {
          const isToday = d.date === todayKey;
          const has = d.sessions > 0;
          return (
            <div
              key={d.date}
              className={`week-dot${has ? " has" : " empty"}${isToday ? " today" : ""}`}
              title={`${d.date}: ${Math.round(d.minutes)} min`}
            >
              <i />
              <span>{frenchDayLabel(d.date)}</span>
            </div>
          );
        })}
      </div>

      {summary.categories.length > 0 && (
        <div>
          <h2 className="section-kicker">Par point de grammaire</h2>
          {summary.categories.map((row, i) => (
            <div key={row.id} className={`category-row${i % 2 ? " warm" : ""}`}>
              <span className="category-name">{row.label}</span>
              <div className="category-bar-track" aria-hidden="true">
                <div
                  className="category-bar-fill"
                  style={{ width: `${row.accuracy == null ? 0 : row.accuracy}%` }}
                />
              </div>
              <span className="category-meta">
                {row.accuracy == null ? "—" : `${row.accuracy}%`}
              </span>
            </div>
          ))}
        </div>
      )}

      {summary.recent.length > 0 && (
        <div>
          <h2 className="section-kicker">Dernières séances</h2>
          {summary.recent.slice(0, 4).map((s) => {
            const acc = accuracyPct(s.utterances, s.corrections);
            return (
              <div key={s.id} className="recent-item">
                <span>{s.scenarioTitle}</span>
                <span className="recent-meta">
                  {formatMinutes(s.durationMs)}
                  {acc == null ? "" : ` · ${acc}%`}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {summary.totalSessions > 0 && (
        <button type="button" className="text-btn reset" onClick={onReset}>
          Réinitialiser
        </button>
      )}
    </section>
  );
}
