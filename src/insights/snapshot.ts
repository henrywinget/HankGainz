import type { Dataset, Day, RangeDays } from "@/lib/dataset";
import { windowDays } from "@/lib/dataset";
import { adaptiveTdee, classifyRate, rateVerdict, targetIntake, trendRate, type Rate, type RateStatus, type Tdee } from "@/metrics/body";
import { detectStalls, type LiftSession, type StallInfo } from "@/metrics/training";
import { mean, median } from "@/metrics/stats";
import { weekStart, addDays, daysBetween } from "@/lib/dates";
import { judgesRate } from "@/config/settings";
import type { Muscle } from "@/config/exercises";
import { RULES } from "@/guidelines";

export interface Snapshot {
  range: RangeDays;
  days: Day[];
  from: string;
  to: string;
  trendNowKg: number | null;
  trendStartKg: number | null;
  rate28: Rate | null;
  rate14: Rate | null;
  /** Rate measured only within the current phase (window = min(28, days in phase), ≥ 14 days). */
  phaseRate: Rate | null;
  /** Days into the current phase (null if no phase today). */
  phaseDay: number | null;
  rateStatus: RateStatus | null;
  rateVerdict: { label: string; tone: "good" | "warn" | "bad" } | null;
  tdee: Tdee | null;
  targetKcal: number | null;
  loggedDays: number;
  fastDays: number;
  avgKcal: number | null;
  medianKcal: number | null;
  avgProteinG: number | null;
  proteinGPerKg: number | null;
  proteinDaysOnTarget: number;
  avgSteps: number | null;
  stepDaysAtGoal: number;
  stepDays: number;
  sessions: number;
  sessionsPerWeek: number;
  workingSets: number;
  tonnageKg: number;
  prs: { liftId: string; session: LiftSession }[];
  stalls: StallInfo[];
  /** avg weekly fractional sets per muscle across the window's full weeks */
  muscleSetsPerWeek: Map<Muscle, number>;
  bigDays: Day[];
  mealProtein: { meal: string; avgG: number; days: number }[];
}

export function buildSnapshot(ds: Dataset, range: RangeDays): Snapshot {
  const days = windowDays(ds, range);
  const s = ds.settings;
  const from = days[0]?.date ?? ds.today;
  const to = ds.today;
  const lastFull = addDays(ds.today, -1);

  const trendNowKg = ds.trend.get(to) ?? null;
  const rate28 = trendRate(ds.trend, ds.weighIns, to, 28);
  const rate14 = trendRate(ds.trend, ds.weighIns, to, 14);
  const cur = ds.currentPhase;
  const phaseDay = cur ? daysBetween(cur.start, to) + 1 : null;
  // Judge the current goal on data from the current phase only, so last month's different goal doesn't skew it.
  const window = phaseDay == null ? 28 : Math.min(28, phaseDay);
  const phaseRate = window >= 14 ? trendRate(ds.trend, ds.weighIns, to, window) : null;
  const rateStatus = phaseRate && judgesRate(s.phase) ? classifyRate(phaseRate.pctPerMonth, s) : null;
  const tdee = adaptiveTdee(lastFull, ds.trend, ds.kcalByDay);
  const targetKcal = s.kcalTarget ?? (tdee && trendNowKg ? targetIntake(tdee.kcal, trendNowKg, s) : null);

  const logged = days.filter((d) => d.kcal != null);
  const kcals = logged.map((d) => d.kcal!);
  const proteinDays = logged.filter((d) => d.trendKg && !d.isFast);
  const proteinPerKg = proteinDays.map((d) => d.proteinG! / d.trendKg!);
  // Each day is judged against the protein floor of the phase it belonged to.
  const proteinHits = proteinDays.filter((d) => d.proteinG! / d.trendKg! >= (ds.phaseOn(d.date)?.targets.proteinMinGPerKg ?? s.proteinMinGPerKg)).length;
  const stepDaysArr = days.filter((d) => d.steps != null);
  const trainedDays = days.filter((d) => d.trained && d.workingSets > 0);

  const prs: Snapshot["prs"] = [];
  for (const [liftId, xs] of ds.liftSessions) for (const x of xs) if (x.isPr && x.date >= from) prs.push({ liftId, session: x });
  prs.sort((a, b) => b.session.date.localeCompare(a.session.date));

  // Full ISO weeks inside the window (exclude the current partial week).
  const thisWeek = weekStart(ds.today);
  const weeks = [...new Set(days.map((d) => weekStart(d.date)))].filter((w) => w >= weekStart(from) && w < thisWeek && w >= from);
  const muscleSetsPerWeek = new Map<Muscle, number>();
  if (weeks.length) {
    for (const w of weeks) for (const [m, n] of ds.muscleWeeks.get(w) ?? []) muscleSetsPerWeek.set(m, (muscleSetsPerWeek.get(m) ?? 0) + n);
    for (const [m, n] of muscleSetsPerWeek) muscleSetsPerWeek.set(m, n / weeks.length);
  }

  const med = kcals.length ? median(kcals) : null;
  const bigDays = med ? logged.filter((d) => d.kcal! > med * 2) : [];

  const mealMap = new Map<string, number[]>();
  for (const d of logged) for (const m of ds.mealsByDay.get(d.date) ?? []) if (m.kcal > 0) (mealMap.get(m.meal) ?? mealMap.set(m.meal, []).get(m.meal)!).push(m.proteinG);
  const order = ["Breakfast", "Lunch", "Dinner", "Snacks"];
  const mealProtein = [...mealMap.entries()]
    .map(([meal, xs]) => ({ meal, avgG: mean(xs), days: xs.length }))
    .sort((a, b) => order.indexOf(a.meal) - order.indexOf(b.meal));

  const weeksInRange = Math.max(1, days.length / 7);

  return {
    range, days, from, to,
    trendNowKg,
    trendStartKg: days.find((d) => d.trendKg != null)?.trendKg ?? null,
    rate28, rate14, rateStatus,
    phaseRate, phaseDay,
    rateVerdict: rateStatus && phaseRate ? rateVerdict(rateStatus, s.phase, phaseRate.pctPerMonth) : null,
    tdee, targetKcal,
    loggedDays: logged.length,
    fastDays: logged.filter((d) => d.isFast).length,
    avgKcal: kcals.length ? mean(kcals) : null,
    medianKcal: med,
    avgProteinG: logged.length ? mean(logged.map((d) => d.proteinG!)) : null,
    proteinGPerKg: proteinPerKg.length ? mean(proteinPerKg) : null,
    proteinDaysOnTarget: proteinHits,
    avgSteps: stepDaysArr.length ? mean(stepDaysArr.map((d) => d.steps!)) : null,
    stepDaysAtGoal: stepDaysArr.filter((d) => d.steps! >= s.stepGoal).length,
    stepDays: stepDaysArr.length,
    sessions: trainedDays.length,
    sessionsPerWeek: trainedDays.length / weeksInRange,
    workingSets: trainedDays.reduce((a, d) => a + d.workingSets, 0),
    tonnageKg: trainedDays.reduce((a, d) => a + d.tonnageKg, 0),
    prs,
    stalls: detectStalls(ds.liftSessions, ds.today),
    muscleSetsPerWeek,
    bigDays,
    mealProtein,
  };
}

export const MIN_WEIGH_INS_14D = RULES.trend.minWeighInsIn14d;
