import { accuracyPct, formatMinutes, localDateKey, summarizeStats } from "../lib/stats.js";
import { frenchDayLabel, streakAside, streakHeadline, streakHeadlineSoir } from "../lib/copy.js";
import { useTheme } from "./ThemeToggle.jsx";

export default function StatsPanel({ stats, onReset }) {
  const summary = summarizeStats(stats);
  const todayKey = localDateKey(Date.now());
  const { theme } = useTheme();
  const evening = theme === "soir";
  const ringPct = Math.min(100, (summary.streak % 7) * (100 / 7) || (summary.streak ? 100 : 0));
  const maxMinutes = Math.max(8, ...summary.week.map((d) => d.minutes));
  const weekMinutes = summary.week.reduce((sum, d) => sum + d.minutes, 0);

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
          <h2>{evening ? streakHeadlineSoir(summary.streak) : streakHeadline(summary.streak)}</h2>
          <p>
            {evening
              ? `de suite · ${Math.round(weekMinutes)} min cette semaine`
              : streakAside(summary.streak)}
          </p>
        </div>
      </div>

      <div className="week-dots" aria-label="Last 7 days">
        {summary.week.map((d) => {
          const isToday = d.date === todayKey;
          const has = d.sessions > 0;
          const bar = d.minutes <= 0 ? 8 : Math.max(16, Math.round((d.minutes / maxMinutes) * 74));
          return (
            <div
              key={d.date}
              className={`week-dot${has ? " has" : " empty"}${isToday ? " today" : ""}`}
              style={{ "--week-h": `${bar}px` }}
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
          <h2 className="section-kicker">
            {evening ? "Ce qui tient, ce qui glisse" : "Par point de grammaire"}
          </h2>
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
        <div className="recent-block">
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
