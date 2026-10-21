export default function StrengthRing({ value, size = 44 }: { value: number | null; size?: number }) {
  const r = 15;
  const circumference = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const rounded = Math.round(pct);
  const colour =
    value === null ? "#cbd5e1" : pct >= 80 ? "#10b981" : pct >= 60 ? "#4f46e5" : pct >= 40 ? "#f59e0b" : "#ef4444";
  const label = value === null ? "Profile strength: not scored" : `Profile strength: ${rounded}%`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={label} role="img" aria-label={label}>
      <svg viewBox="0 0 40 40" width={size} height={size} className="-rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
        {value !== null && pct > 0 && (
          <circle
            cx="20"
            cy="20"
            r={r}
            fill="none"
            stroke={colour}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * circumference} ${circumference}`}
          />
        )}
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-semibold text-slate-800 ${
          rounded >= 100 ? "text-[8px]" : "text-[10px]"
        }`}
      >
        {value === null ? "-" : `${rounded}%`}
      </span>
    </div>
  );
}