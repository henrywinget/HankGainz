import Link from "next/link";
import type { ReactNode, CSSProperties } from "react";
import { AlertTriangle, Flame, Info, Trophy } from "lucide-react";
import { cn } from "@/lib/cn";
import { GUIDELINES, type Guideline } from "@/guidelines";
import type { Insight, Tone } from "@/insights/rules";
import { RANGES, type RangeDays } from "@/lib/range";
import { AnimatedNumber } from "./animated-number";

export type Accent = "pink" | "cyan" | "purple" | "orange" | "mint" | "sun" | "red";
const accentVar = (a: Accent) => `var(--${a})`;

export function Card({ children, className, accent = "pink", style }: { children: ReactNode; className?: string; accent?: Accent; style?: CSSProperties }) {
  return (
    <section className={cn("card p-5", className)} style={{ ["--accent" as string]: accentVar(accent), ...style }}>
      {children}
    </section>
  );
}

export function CardTitle({ children, sub, right }: { children: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="font-display text-[11px] font-bold uppercase tracking-[0.22em] text-muted">{children}</h2>
        {sub && <p className="mt-1 text-xs text-faint">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export function PageHeader({ title, kicker, children }: { title: string; kicker?: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {kicker && <p className="mb-1 font-script text-2xl text-cyan glow-cyan">{kicker}</p>}
        <h1 className="font-display text-2xl font-black uppercase italic tracking-wider sm:text-3xl">
          <span className="sunset-text">{title}</span>
        </h1>
      </div>
      {children}
    </header>
  );
}

export function RangePicker({ range, path }: { range: RangeDays; path: string }) {
  const opts: RangeDays[] = [...RANGES, "all"];
  return (
    <div className="flex flex-wrap gap-1 rounded-2xl border border-line bg-surface p-1 backdrop-blur" role="tablist" aria-label="Time range">
      {opts.map((r) => {
        const active = r === range;
        return (
          <Link
            key={r}
            href={`${path}?range=${r}`}
            scroll={false}
            role="tab"
            aria-selected={active}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-semibold tracking-wide transition",
              active ? "bg-pink text-white shadow-[0_0_18px_rgb(255_42_109/0.55)]" : "text-muted hover:bg-white/5 hover:text-text",
            )}
          >
            {r === "all" ? "All" : r === 365 ? "1y" : `${r}d`}
          </Link>
        );
      })}
    </div>
  );
}

export function Stat({
  label, value, unit, digits = 0, sub, accent = "cyan", delta, deltaGood,
}: {
  label: string; value: number | null; unit?: string; digits?: number; sub?: ReactNode; accent?: Accent;
  delta?: string; deltaGood?: boolean | null;
}) {
  return (
    <Card accent={accent} className="flex flex-col gap-1.5">
      <span className="font-display text-[10px] font-bold uppercase tracking-[0.22em] text-muted">{label}</span>
      <div className="flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-bold tabular-nums" style={{ color: accentVar(accent), textShadow: `0 0 18px color-mix(in srgb, ${accentVar(accent)} 45%, transparent)` }}>
          {value == null ? "—" : <AnimatedNumber value={value} digits={digits} />}
        </span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
        {delta && (
          <span className={cn("ml-auto rounded-full px-2 py-0.5 text-xs font-semibold", deltaGood == null ? "bg-white/5 text-muted" : deltaGood ? "bg-mint/10 text-mint" : "bg-red/10 text-red")}>{delta}</span>
        )}
      </div>
      {sub && <div className="text-xs text-faint">{sub}</div>}
    </Card>
  );
}

/** Progress toward a target band. Fills to `value`, shades the [min,max] target zone. */
export function TargetBar({ value, min, max, scaleMax, label, format = (n: number) => n.toFixed(0), accent = "pink" }: {
  value: number | null; min: number; max?: number; scaleMax: number; label: ReactNode; format?: (n: number) => string; accent?: Accent;
}) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / scaleMax) * 100))}%`;
  const hit = value != null && value >= min && (max == null || value <= max);
  const over = value != null && max != null && value > max;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className={cn("font-display font-bold tabular-nums", hit ? "text-mint" : over ? "text-orange" : "text-text")}>
          {value == null ? "—" : format(value)}
          <span className="ml-1 font-sans font-normal text-faint">/ {format(min)}{max != null ? `–${format(max)}` : "+"}</span>
        </span>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-white/6">
        <div className="absolute inset-y-0 bg-mint/15" style={{ left: pct(min), width: max != null ? `calc(${pct(max)} - ${pct(min)})` : `calc(100% - ${pct(min)})` }} />
        {value != null && (
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000"
            style={{
              width: pct(value),
              background: hit ? "linear-gradient(90deg, var(--cyan), var(--mint))" : `linear-gradient(90deg, var(--purple), ${accentVar(over ? "orange" : accent)})`,
              boxShadow: `0 0 12px ${hit ? "var(--mint)" : accentVar(over ? "orange" : accent)}`,
            }}
          />
        )}
      </div>
    </div>
  );
}

const TONE: Record<Tone, { icon: typeof Info; color: string; label: string }> = {
  harsh: { icon: Flame, color: "var(--red)", label: "Reality check" },
  warn: { icon: AlertTriangle, color: "var(--orange)", label: "Heads up" },
  win: { icon: Trophy, color: "var(--mint)", label: "Win" },
  info: { icon: Info, color: "var(--cyan)", label: "Intel" },
};

export function InsightCard({ insight }: { insight: Insight }) {
  const t = TONE[insight.tone];
  const g: Guideline | null = insight.guideline ? GUIDELINES[insight.guideline] : null;
  const Icon = t.icon;
  return (
    <article
      className="relative overflow-hidden rounded-2xl border border-line bg-surface-2 p-4 backdrop-blur"
      style={{ boxShadow: `inset 3px 0 0 ${t.color}, 0 0 32px -18px ${t.color}` }}
    >
      <div className="mb-1 flex items-center gap-2">
        <Icon className="size-4" style={{ color: t.color, filter: `drop-shadow(0 0 6px ${t.color})` }} />
        <span className="font-display text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: t.color }}>{t.label}</span>
      </div>
      <h3 className="font-semibold leading-snug">{insight.title}</h3>
      <p className="mt-1 text-sm leading-relaxed text-muted">{insight.body}</p>
      {(insight.basis || g) && (
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          {insight.basis}
          {g && (
            <>
              {insight.basis && " · "}
              <span title={`${g.summary} (Evidence grade ${g.grade})`}>
                {g.url ? <a href={g.url} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-cyan">{g.title} [{g.grade}]</a> : `${g.title} [${g.grade}]`}
              </span>
            </>
          )}
        </p>
      )}
    </article>
  );
}

export function InsightFeed({ insights, limit }: { insights: Insight[]; limit?: number }) {
  const list = limit ? insights.slice(0, limit) : insights;
  if (!list.length) return <p className="text-sm text-muted">No insights yet. Import some data.</p>;
  return <div className="grid gap-3">{list.map((i) => <InsightCard key={i.id} insight={i} />)}</div>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-line text-sm text-faint">{children}</div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("card animate-pulse bg-surface", className)} />;
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-12 w-72" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-28" />)}</div>
      <Skeleton className="h-80" />
    </div>
  );
}
