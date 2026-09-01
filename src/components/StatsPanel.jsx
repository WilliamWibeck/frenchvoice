import { accuracyPct, formatMinutes, summarizeStats } from "../lib/stats.js";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function dayLabel(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

export default function StatsPanel({ stats, onReset }) {
  const summary = summarizeStats(stats);
  const maxMinutes = Math.max(8, ...summary.week.map((d) => d.minutes));

  return (
    <section className="stats-panel" aria-label="Practice stats">
      <div className="stats-kpis">
        <div className="kpi">
          <span className="kpi-value">{summary.streak}</span>
          <span className="kpi-label">day streak</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{formatMinutes(summary.totalMs)}</span>
          <span className="kpi-label">practiced</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">
            {summary.accuracy == null ? "—" : `${summary.accuracy}%`}
          </span>
          <span className="kpi-label">accuracy</span>
        </div>
        <div className="kpi">
          <span className="kpi-value">{summary.totalSessions}</span>
          <span className="kpi-label">{summary.totalSessions === 1 ? "session" : "sessions"}</span>
        </div>
      </div>

      <div className="week-row" aria-label="Last 7 days">
        {summary.week.map((d) => {
          const height = d.minutes <= 0 ? 4 : Math.max(8, Math.round((d.minutes / maxMinutes) * 40));
          return (
            <div key={d.date} className="week-day" title={`${d.date}: ${Math.round(d.minutes)} min`}>
              <div className="week-bar-wrap">
                <div
                  className={`week-bar ${d.sessions ? "has-practice" : ""}`}
                  style={{ height: `${height}px` }}
                />
              </div>
              <span>{dayLabel(d.date)}</span>
            </div>
          );
        })}
      </div>

      {summary.byScenario.length > 0 && (
        <div className="scenario-stats">
          {summary.byScenario.map((row) => (
            <div key={row.id} className="scenario-stat-row">
              <span>{row.title}</span>
              <span>
                {row.sessions} {row.sessions === 1 ? "session" : "sessions"} · {formatMinutes(row.ms)}
              </span>
            </div>
          ))}
        </div>
      )}

      {summary.recent.length > 0 && (
        <div className="recent-list">
          <h2>Recent sessions</h2>
          {summary.recent.map((s) => {
            const acc = accuracyPct(s.utterances, s.corrections);
            return (
              <div key={s.id} className="recent-item">
                <div>
                  <strong>{s.scenarioTitle}</strong>
                  <span className="recent-mission">{s.mission}</span>
                </div>
                <div className="recent-meta">
                  {formatMinutes(s.durationMs)}
                  {s.utterances ? ` · ${s.utterances} turns` : ""}
                  {acc == null ? "" : ` · ${acc}%`}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {summary.totalSessions > 0 && (
        <button type="button" className="text-btn" onClick={onReset}>
          Reset stats
        </button>
      )}
    </section>
  );
}
