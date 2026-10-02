export function StatBar({ label, value }: { label: string; value: number }) {
  const tier = value >= 80 ? "great" : value >= 60 ? "good" : value >= 40 ? "fair" : "low";
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-track">
        <span className={`stat-fill stat-${tier}`} style={{ width: `${value}%` }} />
      </span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
