export default function SessionSparkline({ turns }) {
  if (!turns || turns.length === 0) return null;
  return (
    <div className="sparkline" role="img" aria-label="Turn-by-turn session">
      {turns.map((t, i) => {
        const kind = t.verdict === "correction" ? t.severity || "major" : t.verdict || "ok";
        return (
          <span
            key={t.itemId || i}
            className={`spark spark-${kind}`}
            title={`${i + 1}: ${kind}`}
          />
        );
      })}
    </div>
  );
}
