import type { Dataset, Day } from "@/lib/dataset";
import { addDays, weekStart } from "@/lib/dates";
import { linreg, mean, pearson, rolling, strengthOf, zscore, type Strength } from "./stats";
import { RULES } from "@/guidelines";
import { KCAL_PER_KG } from "@/lib/units";

export interface Relation {
  id: string;
  x: string;
  y: string;
  r: number | null;
  n: number;
  strength: Strength | "insufficient";
  points: { x: number; y: number; label: string }[];
  fit: { slope: number; intercept: number } | null;
  note: string;
}

function relation(id: string, x: string, y: string, points: Relation["points"], describe: (r: number, fit: Relation["fit"]) => string): Relation {
  const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
  const n = points.length;
  const r = n >= RULES.correlation.minN ? pearson(xs, ys) : null;
  const lr = n >= RULES.correlation.minN ? linreg(xs, ys) : null;
  const fit = lr ? { slope: lr.slope, intercept: lr.intercept } : null;
  return {
    id, x, y, r, n, points, fit,
    strength: r == null ? "insufficient" : strengthOf(r),
    note: r == null ? `Need at least ${RULES.correlation.minN} data points (have ${n}).` : describe(r, fit),
  };
}

const avgOf = (days: Day[], f: (d: Day) => number | null) => {
  const xs = days.map(f).filter((v): v is number => v != null);
  return xs.length ? mean(xs) : null;
};

/** Correlations within the window. All of these are correlation, not causation, and the UI says so. */
export function computeRelations(ds: Dataset, days: Day[]): Relation[] {
  const byDate = ds.byDate;
  const prior = (date: string, n: number) => Array.from({ length: n }, (_, i) => byDate.get(addDays(date, -(i + 1)))).filter(Boolean) as Day[];
  const from = days[0]?.date ?? ds.today;

  // 1. Weekly calories vs. weekly trend change → empirical maintenance.
  const weeks = new Map<string, Day[]>();
  for (const d of days) (weeks.get(weekStart(d.date)) ?? weeks.set(weekStart(d.date), []).get(weekStart(d.date))!).push(d);
  const weekPts: Relation["points"] = [];
  for (const [wk, ds7] of weeks) {
    if (ds7.length < 7) continue;
    const kcal = avgOf(ds7, (d) => d.kcal);
    const t0 = ds.trend.get(addDays(wk, -1)), t1 = ds.trend.get(addDays(wk, 6));
    if (kcal == null || t0 == null || t1 == null || ds7.filter((d) => d.kcal != null).length < 5) continue;
    weekPts.push({ x: kcal, y: ((t1 - t0) * 2.20462), label: wk });
  }
  const kcalVsWeight = relation("kcal_weight", "Avg daily kcal (week)", "Trend change (lb/week)", weekPts, (r, fit) => {
    if (!fit || fit.slope <= 0) return `r = ${r.toFixed(2)}. Calories and weekly weight change don't line up cleanly in this window.`;
    const maint = -fit.intercept / fit.slope;
    return `In your data, weeks around ${Math.round(maint / 10) * 10} kcal/day held weight flat. Each extra 100 kcal/day lined up with about ${(fit.slope * 100).toFixed(2)} lb/week of change (theory: ${(100 * 7 / KCAL_PER_KG * 2.20462).toFixed(2)}).`;
  });

  // 2–4. Session performance vs. what came before it.
  const perfInWindow = ds.perf.filter((p) => p.date >= from);
  const perfVs = (id: string, label: string, n: number, f: (d: Day) => number | null, unit: string) => {
    const pts: Relation["points"] = [];
    for (const p of perfInWindow) {
      const v = avgOf(prior(p.date, n), f);
      if (v != null) pts.push({ x: v, y: p.score, label: p.date });
    }
    return relation(id, label, "Session performance (100 = recent best)", pts, (r) =>
      `r = ${r.toFixed(2)} (${strengthOf(r)}). ${Math.abs(r) >= 0.1 ? `More ${unit} lined up with ${r > 0 ? "better" : "worse"} sessions.` : "No meaningful pattern."}`);
  };
  const perfKcal = perfVs("perf_kcal", "Avg kcal, prior 3 days", 3, (d) => d.kcal, "calories in the prior 3 days");
  const perfProtein = perfVs("perf_protein", "Avg protein g, prior 3 days", 3, (d) => d.proteinG, "protein in the prior 3 days");
  const perfSteps = perfVs("perf_steps", "Steps, day before", 1, (d) => d.steps, "steps the day before");

  // 5. Daily steps vs. calories (do high-step days come with more eating?)
  const stepKcalPts = days.filter((d) => d.steps != null && d.kcal != null && !d.isFast).map((d) => ({ x: d.steps!, y: d.kcal!, label: d.date }));
  const stepsKcal = relation("steps_kcal", "Steps", "Calories", stepKcalPts, (r) => `r = ${r.toFixed(2)} (${strengthOf(r)}). ${Math.abs(r) < 0.1 ? "Step count and intake are unrelated day to day." : r > 0 ? "You tend to eat more on more active days." : "You tend to eat less on more active days."}`);

  return [kcalVsWeight, perfKcal, perfProtein, perfSteps, stepsKcal];
}

/** Z-scored 7-day rolling series for the multi-metric overlay chart. */
export function overlaySeries(days: Day[]) {
  const kcal = zscore(rolling(days.map((d) => d.kcal), 7, 3));
  const protein = zscore(rolling(days.map((d) => d.proteinG), 7, 3));
  const steps = zscore(rolling(days.map((d) => d.steps), 7, 3));
  const weight = zscore(days.map((d) => d.trendKg));
  const volume = zscore(rolling(days.map((d) => d.workingSets), 7, 1));
  const perf = zscore(rolling(days.map((d) => d.perfScore), 14, 1));
  return days.map((d, i) => ({ date: d.date, kcal: kcal[i], protein: protein[i], steps: steps[i], weight: weight[i], volume: volume[i], perf: perf[i] }));
}
