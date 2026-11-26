import type { Settings } from "@/config/settings";
import { RULES } from "@/guidelines";

/**
 * Semicircle gauge of the bodyweight rate (%BW/month) with the target zone in mint,
 * warning margins in orange, and red beyond.
 */
export function RateGauge({ pctPerMonth, settings, label, tone }: {
  pctPerMonth: number | null;
  settings: Pick<Settings, "rateMinPctPerMonth" | "rateMaxPctPerMonth">;
  label: string;
  tone: "good" | "warn" | "bad" | null;
}) {
  const { rateMinPctPerMonth: lo, rateMaxPctPerMonth: hi } = settings;
  const m = RULES.rate.tooFastMarginPct;
  const span = Math.max(3, hi - lo + 4 * m);
  const center = (lo + hi) / 2;
  const min = center - span / 2, max = center + span / 2;
  const toAngle = (v: number) => Math.PI * (1 - (Math.max(min, Math.min(max, v)) - min) / (max - min));
  const R = 80, cx = 100, cy = 96;
  const pt = (a: number, r = R) => [cx + r * Math.cos(a), cy - r * Math.sin(a)] as const;
  const arc = (a0: number, a1: number) => {
    const [x0, y0] = pt(toAngle(a0)), [x1, y1] = pt(toAngle(a1));
    return `M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`;
  };
  const color = tone === "good" ? "var(--mint)" : tone === "warn" ? "var(--orange)" : tone === "bad" ? "var(--red)" : "var(--faint)";
  const needle = pctPerMonth == null ? null : pt(toAngle(pctPerMonth), R - 14);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 112" className="w-full max-w-[260px]" aria-label={`Rate ${pctPerMonth?.toFixed(2)}% per month: ${label}`}>
        <defs>
          <filter id="gauge-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <path d={arc(min, max)} stroke="rgb(255 255 255 / 0.07)" strokeWidth="12" fill="none" strokeLinecap="round" />
        <path d={arc(min, lo - m)} stroke="var(--red)" strokeOpacity="0.55" strokeWidth="12" fill="none" />
        <path d={arc(lo - m, lo)} stroke="var(--orange)" strokeOpacity="0.6" strokeWidth="12" fill="none" />
        <path d={arc(lo, hi)} stroke="var(--mint)" strokeWidth="12" fill="none" filter="url(#gauge-glow)" />
        <path d={arc(hi, hi + m)} stroke="var(--orange)" strokeOpacity="0.6" strokeWidth="12" fill="none" />
        <path d={arc(hi + m, max)} stroke="var(--red)" strokeOpacity="0.55" strokeWidth="12" fill="none" />
        {needle && (
          <g filter="url(#gauge-glow)">
            <line x1={cx} y1={cy} x2={needle[0]} y2={needle[1]} stroke={color} strokeWidth="3" strokeLinecap="round" />
            <circle cx={cx} cy={cy} r="5" fill={color} />
          </g>
        )}
        <text x={pt(Math.PI)[0]} y={cy + 14} textAnchor="middle" className="fill-[var(--faint)] text-[8px]">{min.toFixed(1)}%</text>
        <text x={pt(0)[0]} y={cy + 14} textAnchor="middle" className="fill-[var(--faint)] text-[8px]">{max.toFixed(1)}%</text>
      </svg>
      <div className="-mt-1 text-center">
        <div className="font-display text-2xl font-bold tabular-nums" style={{ color, textShadow: `0 0 16px ${color}` }}>
          {pctPerMonth == null ? "—" : `${pctPerMonth > 0 ? "+" : ""}${pctPerMonth.toFixed(2)}%`}
        </div>
        <div className="text-xs text-muted">BW / month · <span style={{ color }}>{label}</span></div>
        <div className="mt-0.5 text-[11px] text-faint">target {lo}% to {hi}%</div>
      </div>
    </div>
  );
}
