"use client";

import { useMemo, useState } from "react";
import {
  Area, Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, BarChart,
} from "recharts";
import { cn } from "@/lib/cn";
import { PHASE_COLOR, PHASE_SHORT } from "@/config/phase-colors";
import type { Phase } from "@/config/settings";

// ── shared ───────────────────────────────────────────────────────────────
const C = {
  pink: "#ff2a6d", hot: "#ff4fd8", cyan: "#05d9e8", purple: "#b967ff", orange: "#ff9e3d",
  sun: "#ffd319", mint: "#01ffc3", red: "#ff3864", muted: "#a99ad6", faint: "#6c5f9a",
};

const fmtDate = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const axis = { stroke: "transparent", tick: { fill: C.faint, fontSize: 11 }, tickLine: false } as const;

type TipRow = { name?: string | number; value?: unknown; color?: string; dataKey?: unknown };
function Tip({ active, payload, label, fmt, labelFmt = fmtDate }: {
  active?: boolean; payload?: TipRow[]; label?: string | number;
  fmt?: (v: number, key: string) => string; labelFmt?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#120733]/95 px-3 py-2 text-xs shadow-[0_0_30px_-8px_#ff2a6d] backdrop-blur">
      {label != null && <div className="mb-1 font-display text-[10px] tracking-widest text-[#a99ad6]">{labelFmt(String(label))}</div>}
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="size-2 rounded-full" style={{ background: p.color, boxShadow: `0 0 6px ${p.color}` }} />
          <span className="text-[#a99ad6]">{p.name}</span>
          <span className="ml-auto pl-3 font-semibold text-white tabular-nums">{fmt ? fmt(Number(p.value), String(p.dataKey)) : Number(p.value).toLocaleString("en-US", { maximumFractionDigits: 1 })}</span>
        </div>
      ))}
    </div>
  );
}

function Chips<T extends string>({ options, value, onToggle, colors }: { options: { key: T; label: string }[]; value: Set<T>; onToggle: (k: T) => void; colors: Record<T, string> }) {
  return (
    <div className="mb-3 flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.has(o.key);
        return (
          <button
            key={o.key}
            onClick={() => onToggle(o.key)}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition", on ? "text-white" : "border-white/10 text-[#6c5f9a] hover:text-[#a99ad6]")}
            style={on ? { borderColor: colors[o.key], background: `${colors[o.key]}22`, boxShadow: `0 0 14px -4px ${colors[o.key]}` } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Weight ───────────────────────────────────────────────────────────────
type PhaseKind = Phase;

export function WeightChart({ data, height = 300, phases = [] }: {
  data: { date: string; weight: number | null; trend: number | null }[];
  height?: number;
  /** goal phases, drawn as tinted bands */
  phases?: { start: string; end: string | null; kind: PhaseKind }[];
}) {
  const vals = data.flatMap((d) => [d.weight, d.trend]).filter((v): v is number => v != null);
  const lo = Math.floor(Math.min(...vals) - 1), hi = Math.ceil(Math.max(...vals) + 1);
  const first = data[0]?.date, last = data.at(-1)?.date;
  const bands = first && last
    ? phases
        .map((p) => ({ ...p, x1: p.start < first ? first : p.start, x2: p.end == null || p.end > last ? last : p.end }))
        .filter((b) => b.x1 <= b.x2 && b.x1 <= last && b.x2 >= first)
    : [];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={40} {...axis} />
        <YAxis domain={[lo, hi]} {...axis} width={44} />
        {bands.map((b) => (
          <ReferenceArea
            key={`${b.kind}-${b.x1}`}
            x1={b.x1}
            x2={b.x2}
            fill={PHASE_COLOR[b.kind]}
            fillOpacity={0.07}
            stroke={PHASE_COLOR[b.kind]}
            strokeOpacity={0.18}
            label={{ value: PHASE_SHORT[b.kind], position: "insideTopLeft", fill: PHASE_COLOR[b.kind], fontSize: 9, fontWeight: 700, opacity: 0.85 }}
          />
        ))}
        <Tooltip content={<Tip fmt={(v) => `${v.toFixed(1)} lb`} />} />
        <Area type="monotone" dataKey="trend" stroke="none" fill="url(#g-pink)" connectNulls isAnimationActive />
        <Line type="monotone" dataKey="weight" name="Weigh-in" stroke="none" dot={{ r: 2.2, fill: C.cyan, fillOpacity: 0.75, strokeWidth: 0 }} activeDot={{ r: 4, fill: C.cyan }} isAnimationActive={false} />
        <Line type="monotone" dataKey="trend" name="Trend" stroke={C.pink} strokeWidth={3} dot={false} connectNulls filter="url(#neon)" />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Calories ─────────────────────────────────────────────────────────────
export function CaloriesChart({ data, target, height = 280 }: { data: { date: string; kcal: number | null; avg7: number | null; fast: boolean }[]; target: number | null; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={40} {...axis} />
        <YAxis {...axis} width={48} />
        <Tooltip content={<Tip fmt={(v) => `${Math.round(v).toLocaleString()} kcal`} />} />
        <Bar dataKey="kcal" name="Calories" radius={[4, 4, 0, 0]} maxBarSize={18}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.fast ? C.cyan : target && d.kcal != null && d.kcal > target * 1.5 ? C.red : target && d.kcal != null && d.kcal > target ? C.orange : "url(#g-purple)"} />
          ))}
        </Bar>
        <Line type="monotone" dataKey="avg7" name="7-day avg" stroke={C.sun} strokeWidth={2.5} dot={false} connectNulls filter="url(#neon)" />
        {target && <ReferenceLine y={target} stroke={C.mint} strokeDasharray="6 4" label={{ value: `target ${Math.round(target)}`, fill: C.mint, fontSize: 10, position: "insideTopRight" }} />}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function MacroChart({ data, height = 260 }: { data: { date: string; protein: number | null; carbs: number | null; fat: number | null }[]; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={40} {...axis} />
        <YAxis {...axis} width={48} />
        <Tooltip content={<Tip fmt={(v) => `${Math.round(v)} kcal`} />} />
        <Bar dataKey="protein" name="Protein" stackId="m" fill={C.pink} maxBarSize={18} />
        <Bar dataKey="carbs" name="Carbs" stackId="m" fill={C.cyan} maxBarSize={18} />
        <Bar dataKey="fat" name="Fat" stackId="m" fill={C.sun} maxBarSize={18} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Protein per lb of bodyweight; min/max already in g/lb. */
export function ProteinChart({ data, min, max, height = 240 }: { data: { date: string; gPerLb: number | null }[]; min: number; max: number; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={40} {...axis} />
        <YAxis {...axis} width={40} domain={[0, (dataMax: number) => Math.max(max + 0.2, Math.ceil(dataMax * 10) / 10)]} tickFormatter={(v) => Number(v).toFixed(1)} />
        <ReferenceArea y1={min} y2={max} fill={C.mint} fillOpacity={0.08} stroke={C.mint} strokeOpacity={0.25} strokeDasharray="4 4" />
        <Tooltip content={<Tip fmt={(v) => `${v.toFixed(2)} g/lb`} />} />
        <Bar dataKey="gPerLb" name="Protein" radius={[4, 4, 0, 0]} maxBarSize={14}>
          {data.map((d) => <Cell key={d.date} fill={d.gPerLb != null && d.gPerLb >= min ? C.mint : C.pink} fillOpacity={0.85} />)}
        </Bar>
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Steps ────────────────────────────────────────────────────────────────
export function StepsChart({ data, goal, height = 260 }: { data: { date: string; steps: number | null; avg7: number | null }[]; goal: number; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={40} {...axis} />
        <YAxis {...axis} width={48} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
        <Tooltip content={<Tip fmt={(v) => Math.round(v).toLocaleString()} />} />
        <Bar dataKey="steps" name="Steps" radius={[4, 4, 0, 0]} maxBarSize={16}>
          {data.map((d) => <Cell key={d.date} fill={d.steps != null && d.steps >= goal ? C.cyan : C.purple} fillOpacity={d.steps != null && d.steps >= goal ? 0.9 : 0.55} />)}
        </Bar>
        <Line type="monotone" dataKey="avg7" name="7-day avg" stroke={C.hot} strokeWidth={2.5} dot={false} connectNulls filter="url(#neon)" />
        <ReferenceLine y={goal} stroke={C.mint} strokeDasharray="6 4" label={{ value: `goal ${goal.toLocaleString()}`, fill: C.mint, fontSize: 10, position: "insideTopRight" }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// ── Strength ─────────────────────────────────────────────────────────────
const LIFT_COLORS = [C.pink, C.cyan, C.sun, C.purple, C.mint, C.orange];

export function E1rmChart({ lifts, height = 320 }: {
  lifts: { id: string; name: string; points: { date: string; e1rm: number; pr: boolean; set: string }[] }[];
  height?: number;
}) {
  const withData = lifts.filter((l) => l.points.length);
  const colors = Object.fromEntries(withData.map((l, i) => [l.id, LIFT_COLORS[i % LIFT_COLORS.length]])) as Record<string, string>;
  const [on, setOn] = useState<Set<string>>(() => new Set(withData.slice(0, 4).map((l) => l.id)));
  const data = useMemo(() => {
    const byDate = new Map<string, Record<string, number | string | boolean>>();
    for (const l of withData) for (const p of l.points) {
      const row = byDate.get(p.date) ?? { date: p.date };
      row[l.id] = p.e1rm;
      if (p.pr) row[`${l.id}_pr`] = true;
      byDate.set(p.date, row);
    }
    return [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [withData]);
  const names = Object.fromEntries(withData.map((l) => [l.id, l.name]));

  if (!withData.length) return <div className="flex h-40 items-center justify-center text-sm text-[#6c5f9a]">No key-lift sessions in this range.</div>;
  return (
    <div>
      <Chips
        options={withData.map((l) => ({ key: l.id, label: l.name }))}
        value={on}
        colors={colors}
        onToggle={(k) => setOn((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })}
      />
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
            <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={40} {...axis} />
          <YAxis {...axis} width={44} domain={["dataMin - 10", "dataMax + 10"]} tickFormatter={(v) => Math.round(v).toString()} />
          <Tooltip content={<Tip fmt={(v) => `${Math.round(v)} lb`} />} />
          {withData.filter((l) => on.has(l.id)).map((l) => (
            <Line
              key={l.id}
              type="monotone"
              dataKey={l.id}
              name={names[l.id]}
              stroke={colors[l.id]}
              strokeWidth={2.5}
              connectNulls
              filter="url(#neon)"
              dot={(props: { cx?: number; cy?: number; payload?: Record<string, unknown>; index?: number }) => {
                const { cx, cy, payload, index } = props;
                if (cx == null || cy == null || !payload?.[`${l.id}_pr`]) return <g key={`${l.id}-${index}`} />;
                return <g key={`${l.id}-${index}`}><circle cx={cx} cy={cy} r={5} fill={colors[l.id]} /><circle cx={cx} cy={cy} r={9} fill="none" stroke={colors[l.id]} strokeOpacity={0.5} /></g>;
              }}
            />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[11px] text-[#6c5f9a]">Estimated 1RM (Epley, sets ≤ 10 reps). Ringed dots = PRs.</p>
    </div>
  );
}

export function MuscleVolumeChart({ data, min, max }: { data: { muscle: string; sets: number; focus: boolean }[]; min: number; max: number }) {
  const top = Math.max(max + 4, ...data.map((d) => d.sets));
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 4 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" domain={[0, Math.ceil(top)]} {...axis} />
        <YAxis type="category" dataKey="muscle" width={86} {...axis} tick={{ fill: C.muted, fontSize: 11 }} />
        <ReferenceArea x1={min} x2={max} fill={C.mint} fillOpacity={0.07} stroke={C.mint} strokeOpacity={0.25} strokeDasharray="4 4" />
        <Tooltip content={<Tip labelFmt={(l) => l} fmt={(v) => `${v.toFixed(1)} sets/wk`} />} />
        <Bar dataKey="sets" name="Hard sets / week" radius={[0, 6, 6, 0]} maxBarSize={16}>
          {data.map((d) => <Cell key={d.muscle} fill={!d.focus ? C.faint : d.sets < 6 ? C.red : d.sets < min ? C.orange : d.sets > 25 ? C.sun : C.mint} fillOpacity={d.focus ? 0.85 : 0.5} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Relationships ────────────────────────────────────────────────────────
/** Named formatters (functions can't cross the server → client boundary). */
const FORMATS = {
  thousands1: (n: number) => `${(n / 1000).toFixed(1)}k`,
  thousands0: (n: number) => `${(n / 1000).toFixed(0)}k`,
  signed1: (n: number) => `${n > 0 ? "+" : ""}${n.toFixed(1)}`,
  int: (n: number) => n.toFixed(0),
} as const;
export type FormatKey = keyof typeof FORMATS;

export function RelationScatter({ points, fit, xLabel, yLabel, color = C.cyan, height = 230, xFormat, yFormat }: {
  points: { x: number; y: number; label: string }[];
  fit: { slope: number; intercept: number } | null;
  xLabel: string; yLabel: string; color?: string; height?: number;
  xFormat?: FormatKey; yFormat?: FormatKey;
}) {
  const xFmt = xFormat ? FORMATS[xFormat] : undefined;
  const yFmt = yFormat ? FORMATS[yFormat] : undefined;
  const xs = points.map((p) => p.x);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const line = fit && points.length ? [{ x: x0, y: fit.intercept + fit.slope * x0 }, { x: x1, y: fit.intercept + fit.slope * x1 }] : [];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 8, right: 12, bottom: 18, left: -4 }}>
        <CartesianGrid />
        <XAxis type="number" dataKey="x" name={xLabel} domain={["auto", "auto"]} {...axis} tickFormatter={xFmt} label={{ value: xLabel, position: "insideBottom", offset: -10, fill: C.faint, fontSize: 10 }} />
        <YAxis type="number" dataKey="y" name={yLabel} domain={["auto", "auto"]} {...axis} width={48} tickFormatter={yFmt} />
        <ZAxis range={[36, 36]} />
        <Tooltip
          cursor={{ strokeDasharray: "3 3", stroke: C.faint }}
          content={({ active, payload }) => {
            const p = payload?.[0]?.payload as { x: number; y: number; label: string } | undefined;
            if (!active || !p) return null;
            return (
              <div className="rounded-xl border border-white/10 bg-[#120733]/95 px-3 py-2 text-xs backdrop-blur">
                <div className="mb-1 font-display text-[10px] tracking-widest text-[#a99ad6]">{p.label.length === 10 ? fmtDate(p.label) : p.label}</div>
                <div className="text-[#a99ad6]">{xLabel}: <span className="text-white">{xFmt ? xFmt(p.x) : p.x.toFixed(1)}</span></div>
                <div className="text-[#a99ad6]">{yLabel}: <span className="text-white">{yFmt ? yFmt(p.y) : p.y.toFixed(1)}</span></div>
              </div>
            );
          }}
        />
        <Scatter data={points} fill={color} fillOpacity={0.75} />
        {line.length > 0 && <Scatter data={line} line={{ stroke: C.pink, strokeWidth: 2.5, filter: "url(#neon)" }} shape={() => <g />} legendType="none" />}
      </ScatterChart>
    </ResponsiveContainer>
  );
}

type OverlayKey = "weight" | "kcal" | "protein" | "steps" | "volume" | "perf";
const OVERLAY: { key: OverlayKey; label: string; color: string }[] = [
  { key: "weight", label: "Weight trend", color: C.pink },
  { key: "kcal", label: "Calories (7d)", color: C.sun },
  { key: "protein", label: "Protein (7d)", color: C.hot },
  { key: "steps", label: "Steps (7d)", color: C.cyan },
  { key: "volume", label: "Training sets (7d)", color: C.purple },
  { key: "perf", label: "Performance (14d)", color: C.mint },
];

export function OverlayChart({ data, height = 340 }: { data: ({ date: string } & Record<OverlayKey, number | null>)[]; height?: number }) {
  const [on, setOn] = useState<Set<OverlayKey>>(new Set(["weight", "kcal", "steps", "perf"]));
  const colors = Object.fromEntries(OVERLAY.map((o) => [o.key, o.color])) as Record<OverlayKey, string>;
  return (
    <div>
      <Chips options={OVERLAY} value={on} colors={colors} onToggle={(k) => setOn((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; })} />
      <ResponsiveContainer width="100%" height={height}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -4 }}>
            <CartesianGrid vertical={false} />
          <XAxis dataKey="date" tickFormatter={fmtDate} minTickGap={40} {...axis} />
          <YAxis {...axis} width={44} domain={[-2.5, 2.5]} ticks={[-2, -1, 0, 1, 2]} tickFormatter={(v) => (v === 0 ? "avg" : `${v > 0 ? "+" : ""}${v}σ`)} />
          <ReferenceLine y={0} stroke={C.faint} strokeOpacity={0.6} />
          <Tooltip content={<Tip fmt={(v) => `${v > 0 ? "+" : ""}${v.toFixed(2)}σ`} />} />
          {OVERLAY.filter((o) => on.has(o.key)).map((o) => (
            <Line key={o.key} type="monotone" dataKey={o.key} name={o.label} stroke={o.color} strokeWidth={2.2} dot={false} connectNulls filter="url(#neon)" />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      <p className="mt-1 text-[11px] text-[#6c5f9a]">Each metric is scaled to standard deviations from its own average in this window, so lines with different units can share an axis.</p>
    </div>
  );
}
