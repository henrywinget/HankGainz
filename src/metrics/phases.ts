import type { Dataset } from "@/lib/dataset";
import type { GoalPhase } from "@/lib/phases";
import { addDays, daysBetween } from "@/lib/dates";
import { linreg, mean } from "./stats";
import { classifyRate, rateVerdict, type RateStatus } from "./body";
import { EXERCISE_BY_ID } from "@/config/exercises";
import { judgesRate } from "@/config/settings";

export interface LiftChange {
  liftId: string;
  name: string;
  startKg: number;
  endKg: number;
}

export interface PhaseReport {
  phase: GoalPhase;
  from: string;
  to: string; // clipped to today for the ongoing phase
  days: number;
  ongoing: boolean;
  trendStartKg: number | null;
  trendEndKg: number | null;
  /** regression slope of the trend across the phase */
  ratePctPerMonth: number | null;
  rateStatus: RateStatus | null;
  verdict: { label: string; tone: "good" | "warn" | "bad" } | null;
  loggedDays: number;
  avgKcal: number | null;
  avgProteinGPerKg: number | null;
  proteinHitPct: number | null;
  sessionsPerWeek: number;
  avgSteps: number | null;
  /** best e1RM in the first vs last 21 days of the phase, key lifts trained in both */
  lifts: LiftChange[];
  /** For an off-plan phase right after a cut: share of the cut's loss that came back. */
  regainOfPrevious: number | null;
}

const LIFT_WINDOW = 21;

export function phaseReport(ds: Dataset, phase: GoalPhase, previous?: PhaseReport | null): PhaseReport {
  const from = phase.start < (ds.days[0]?.date ?? phase.start) ? ds.days[0]?.date ?? phase.start : phase.start;
  const to = phase.end && phase.end < ds.today ? phase.end : ds.today;
  const days = ds.days.filter((d) => d.date >= from && d.date <= to);
  const n = Math.max(1, daysBetween(from, to) + 1);

  const xs: number[] = [], ys: number[] = [];
  days.forEach((d, i) => { if (d.trendKg != null) { xs.push(i); ys.push(d.trendKg); } });
  const lr = xs.length >= 7 ? linreg(xs, ys) : null;
  const mid = ys.length ? mean(ys) : null;
  const ratePctPerMonth = lr && mid ? ((lr.slope * 30.44) / mid) * 100 : null;
  const judged = judgesRate(phase.kind) && ratePctPerMonth != null && n >= 14;
  const rateStatus = judged ? classifyRate(ratePctPerMonth!, phase.targets) : null;

  const logged = days.filter((d) => d.kcal != null);
  const eating = logged.filter((d) => !d.isFast && d.trendKg);
  const gpk = eating.map((d) => d.proteinG! / d.trendKg!);

  const lifts: LiftChange[] = [];
  const early = addDays(from, LIFT_WINDOW - 1), late = addDays(to, -(LIFT_WINDOW - 1));
  if (n >= LIFT_WINDOW * 2) {
    for (const [liftId, sessions] of ds.liftSessions) {
      const a = sessions.filter((s) => s.date >= from && s.date <= early);
      const b = sessions.filter((s) => s.date >= late && s.date <= to);
      if (a.length && b.length) lifts.push({ liftId, name: EXERCISE_BY_ID.get(liftId)?.name ?? liftId, startKg: Math.max(...a.map((s) => s.e1rmKg)), endKg: Math.max(...b.map((s) => s.e1rmKg)) });
    }
  }

  const trendStartKg = ds.trend.get(addDays(from, -1)) ?? ds.trend.get(from) ?? null;
  const trendEndKg = ds.trend.get(to) ?? null;
  let regainOfPrevious: number | null = null;
  if (phase.kind === "off_plan" && previous?.phase.kind === "cut" && previous.trendStartKg && previous.trendEndKg && trendStartKg && trendEndKg) {
    const lost = previous.trendStartKg - previous.trendEndKg;
    if (lost > 0) regainOfPrevious = (trendEndKg - trendStartKg) / lost;
  }

  const steps = days.filter((d) => d.steps != null);
  return {
    phase, from, to, days: n, ongoing: phase.end == null || phase.end >= ds.today,
    trendStartKg, trendEndKg, ratePctPerMonth, rateStatus,
    verdict: rateStatus && ratePctPerMonth != null ? rateVerdict(rateStatus, phase.kind, ratePctPerMonth) : null,
    loggedDays: logged.length,
    avgKcal: logged.length ? mean(logged.map((d) => d.kcal!)) : null,
    avgProteinGPerKg: gpk.length ? mean(gpk) : null,
    proteinHitPct: gpk.length ? gpk.filter((x) => x >= phase.targets.proteinMinGPerKg).length / gpk.length : null,
    sessionsPerWeek: days.filter((d) => d.workingSets > 0).length / (n / 7),
    avgSteps: steps.length ? mean(steps.map((d) => d.steps!)) : null,
    lifts,
    regainOfPrevious,
  };
}

/** Reports for every phase that overlaps the data, oldest first. */
export function allPhaseReports(ds: Dataset): PhaseReport[] {
  const first = ds.days[0]?.date;
  const out: PhaseReport[] = [];
  for (const p of ds.phases) {
    if (first && p.end && p.end < first) continue;
    if (p.start > ds.today) continue;
    out.push(phaseReport(ds, p, out.at(-1) ?? null));
  }
  return out;
}
