import { linreg } from "./stats";
import { addDays, dateRange } from "@/lib/dates";
import { KCAL_PER_KG } from "@/lib/units";
import { RULES } from "@/guidelines";
import type { Phase, Settings } from "@/config/settings";

const DAYS_PER_MONTH = 30.44;

/** EWMA trend over every calendar day from the first weigh-in; days without a weigh-in carry the trend. */
export function ewmaTrend(weighIns: Map<string, number>, to: string, alpha: number = RULES.trend.alpha): Map<string, number> {
  const out = new Map<string, number>();
  const dates = [...weighIns.keys()].sort();
  if (!dates.length) return out;
  let t: number | null = null;
  for (const d of dateRange(dates[0], to > dates.at(-1)! ? to : dates.at(-1)!)) {
    const w = weighIns.get(d);
    if (w != null) t = t == null ? w : t + alpha * (w - t);
    if (t != null) out.set(d, t);
  }
  return out;
}

export interface Rate {
  windowDays: number;
  kgPerWeek: number;
  pctPerMonth: number;
  weighIns: number;
}

/** Slope of the trend over the trailing window ending at `end`. */
export function trendRate(trend: Map<string, number>, weighIns: Map<string, number>, end: string, windowDays: number): Rate | null {
  const xs: number[] = [], ys: number[] = [];
  let count = 0;
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = addDays(end, -i);
    const t = trend.get(d);
    if (t != null) {
      xs.push(windowDays - 1 - i);
      ys.push(t);
    }
    if (weighIns.has(d)) count++;
  }
  const lr = linreg(xs, ys);
  const current = trend.get(end) ?? ys.at(-1);
  if (!lr || current == null || xs.length < windowDays * 0.6) return null;
  return {
    windowDays,
    kgPerWeek: lr.slope * 7,
    pctPerMonth: ((lr.slope * DAYS_PER_MONTH) / current) * 100,
    weighIns: count,
  };
}

export type RateStatus = "on_target" | "above" | "far_above" | "below" | "far_below";

export function classifyRate(pctPerMonth: number, s: Pick<Settings, "rateMinPctPerMonth" | "rateMaxPctPerMonth">): RateStatus {
  const m = RULES.rate.tooFastMarginPct, tol = RULES.rate.tolerancePct;
  if (pctPerMonth > s.rateMaxPctPerMonth + m) return "far_above";
  if (pctPerMonth > s.rateMaxPctPerMonth + tol) return "above";
  if (pctPerMonth < s.rateMinPctPerMonth - m) return "far_below";
  if (pctPerMonth < s.rateMinPctPerMonth - tol) return "below";
  return "on_target";
}

/** Human meaning of a rate status for the given phase (pct needed to tell a slow cut from a stalled one). */
export function rateVerdict(status: RateStatus, phase: Phase, pctPerMonth: number): { label: string; tone: "good" | "warn" | "bad" } {
  const table: Record<Exclude<Phase, "off_plan">, Record<RateStatus, string>> = {
    lean_gain: { on_target: "Lean-gain zone", above: "Gaining a bit fast", far_above: "Gaining too fast", below: "Gaining too slowly", far_below: "Losing weight" },
    maintain: { on_target: "Holding steady", above: "Drifting up", far_above: "Gaining", below: "Drifting down", far_below: "Losing" },
    cut: { on_target: "Cutting on pace", above: "Cutting a bit slow", far_above: "Cut is slow", below: "Losing a bit fast", far_below: "Losing too fast" },
  };
  if (phase === "off_plan") return { label: "No rate goal", tone: "warn" };
  let tone: "good" | "warn" | "bad" = status === "on_target" ? "good" : status.startsWith("far") ? "bad" : "warn";
  let label = table[phase][status];
  // A cut that's still losing, just slower than planned, is a heads-up, not a failure. Only call it stalled at ≥ 0.
  if (phase === "cut" && status === "far_above") {
    if (pctPerMonth >= 0) label = "Cut has stalled";
    else tone = "warn";
  }
  return { label, tone };
}

export interface Tdee {
  kcal: number;
  avgIntake: number;
  loggedDays: number;
  windowDays: number;
  trendDeltaKg: number;
  confidence: "low" | "medium" | "high";
}

/** Adaptive maintenance estimate: intake minus the energy implied by the trend change. */
export function adaptiveTdee(
  end: string,
  trend: Map<string, number>,
  kcalByDay: Map<string, number>,
  windowDays: number = RULES.tdee.windowDays,
): Tdee | null {
  const start = addDays(end, -(windowDays - 1));
  const intake: number[] = [];
  for (const d of dateRange(start, end)) {
    const k = kcalByDay.get(d);
    if (k != null) intake.push(k);
  }
  const t0 = trend.get(addDays(start, -1)) ?? trend.get(start);
  const t1 = trend.get(end);
  if (t0 == null || t1 == null || intake.length < RULES.tdee.minLoggedDays) return null;
  const avgIntake = intake.reduce((a, b) => a + b, 0) / intake.length;
  const delta = t1 - t0;
  const kcal = avgIntake - (delta * KCAL_PER_KG) / windowDays;
  const coverage = intake.length / windowDays;
  return {
    kcal,
    avgIntake,
    loggedDays: intake.length,
    windowDays,
    trendDeltaKg: delta,
    confidence: coverage > 0.9 ? "high" : coverage > 0.7 ? "medium" : "low",
  };
}

/** Daily calories needed to hit the middle of the target rate, given maintenance. */
export function targetIntake(tdeeKcal: number, trendKg: number, s: Pick<Settings, "rateMinPctPerMonth" | "rateMaxPctPerMonth">): number {
  const midPct = (s.rateMinPctPerMonth + s.rateMaxPctPerMonth) / 2;
  const kgPerDay = (midPct / 100) * trendKg / DAYS_PER_MONTH;
  return tdeeKcal + kgPerDay * KCAL_PER_KG;
}
