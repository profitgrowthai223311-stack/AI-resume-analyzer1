export function ScoreRing({
  score,
  size = 132,
  label = "ATS score",
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const color =
    score >= 70
      ? "var(--success)"
      : score >= 40
        ? "var(--warning)"
        : "var(--destructive)";
  return (
    <div
      className="relative inline-flex"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${label}: ${score} out of 100`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--muted)"
          strokeWidth="12"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (score / 100) * c}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold">{score}</span>
        <span className="text-muted-foreground text-[11px]">{label}</span>
      </div>
    </div>
  );
}
