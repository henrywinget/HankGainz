import { cache } from "react";
import { connection } from "next/server";
import { asc, isNotNull } from "drizzle-orm";
import { getDb, type DB } from "@/db/client";
import { dailySteps, imports, meals, weighIns, workoutSets } from "@/db/schema";
import { readSettings } from "./settings";
import { readPhases, phaseOn, implicitPhase, type GoalPhase } from "./phases";
import { todayIn, dateRange, addDays } from "./dates";
import type { Settings } from "@/config/settings";
import { ewmaTrend } from "@/metrics/body";
import { keyLiftSessions, sessionPerformance, weeklyMuscleSets, type LiftSession, type SessionPerf, type SetRow } from "@/metrics/training";
import type { Muscle } from "@/config/exercises";
import { EXERCISE_BY_ID } from "@/config/exercises";

export interface Day {
  date: string;
  weightKg: number | null;
  trendKg: number | null;
  /** null = no nutrition logged (or today, which is still in progress). 0 = a real fast day. */
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  fiberG: number | null;
  mealCount: number;
  isFast: boolean;
  /** null for today (partial) or no data */
  steps: number | null;
  trained: boolean;
  workingSets: number;
  tonnageKg: number;
  perfScore: number | null;
}

export interface MealAgg {
  meal: string;
  proteinG: number;
  kcal: number;
}

export interface Dataset {
  /** Effective settings: stored settings with phase/rate/protein taken from the current goal phase. */
  settings: Settings;
  /** Goal phases, oldest first (an implicit one from settings if none are defined). */
  phases: GoalPhase[];
  currentPhase: GoalPhase | null;
  /** Phase active on a date (null in gaps / before the first phase). */
  phaseOn: (date: string) => GoalPhase | null;
  today: string;
  days: Day[];
  byDate: Map<string, Day>;
  trend: Map<string, number>;
  weighIns: Map<string, number>;
  kcalByDay: Map<string, number>;
  sets: SetRow[];
  liftSessions: Map<string, LiftSession[]>;
  perf: SessionPerf[];
  muscleWeeks: Map<string, Map<Muscle, number>>;
  mealsByDay: Map<string, MealAgg[]>;
  flaggedSets: number;
  importsCount: number;
  firstDataDate: string | null;
}

const FAST_KCAL = 100;

/** Loads and derives everything once per request. Data is small (hundreds of days), so derive in memory. */
export const loadDataset = cache(async (): Promise<Dataset> => {
  await connection(); // DB reads are request-time, never prerendered
  return buildDataset(getDb());
});

export function buildDataset(db: DB, now: Date = new Date()): Dataset {
  const stored = readSettings(db);
  const today = todayIn(stored.timeZone, now);

  const wRows = db.select().from(weighIns).orderBy(asc(weighIns.localDate)).all();
  const mRows = db.select().from(meals).all();
  const sRows = db.select().from(dailySteps).all();
  const setRows = db.select().from(workoutSets).orderBy(asc(workoutSets.workoutStart)).all();
  const flaggedSets = db.select({ id: workoutSets.id }).from(workoutSets).where(isNotNull(workoutSets.flagReason)).all().length;
  const importsCount = db.select({ id: imports.id }).from(imports).all().length;

  const weighInMap = new Map(wRows.map((r) => [r.localDate, r.weightKg]));
  const trend = ewmaTrend(weighInMap, today);

  const mealsByDay = new Map<string, MealAgg[]>();
  const nut = new Map<string, { kcal: number; p: number; c: number; f: number; fib: number; n: number }>();
  for (const m of mRows) {
    const a = nut.get(m.localDate) ?? { kcal: 0, p: 0, c: 0, f: 0, fib: 0, n: 0 };
    a.kcal += m.kcal; a.p += m.proteinG; a.c += m.carbsG; a.f += m.fatG; a.fib += m.fiberG ?? 0; a.n++;
    nut.set(m.localDate, a);
    (mealsByDay.get(m.localDate) ?? mealsByDay.set(m.localDate, []).get(m.localDate)!).push({ meal: m.meal, proteinG: m.proteinG, kcal: m.kcal });
  }
  const kcalByDay = new Map<string, number>();
  for (const [d, a] of nut) if (d < today) kcalByDay.set(d, a.kcal);

  const steps = new Map(sRows.map((r) => [r.localDate, r.steps]));

  // Strong is the source of truth for training; MFP strength entries fill in only days Strong doesn't cover.
  const strongDays = new Set(setRows.filter((r) => r.source === "strong").map((r) => r.localDate));
  // Flagged outliers stay out of every metric until reviewed on the Import page.
  const sets: SetRow[] = setRows.filter((r) => !r.flagReason && (r.source === "strong" || !strongDays.has(r.localDate))).map((r) => ({
    localDate: r.localDate, workoutStart: r.workoutStart, workoutName: r.workoutName, workoutDurationS: r.workoutDurationS,
    exerciseId: r.exerciseId, exerciseRaw: r.exerciseRaw, setType: r.setType, weightKg: r.weightKg, reps: r.reps, durationS: r.durationS,
  }));
  const bodyweightOn = (d: string) => trend.get(d) ?? null;
  const liftSessions = keyLiftSessions(sets, bodyweightOn);
  const perf = sessionPerformance(liftSessions);
  const perfByDate = new Map(perf.map((p) => [p.date, p.score]));
  const muscleWeeks = weeklyMuscleSets(sets);

  const train = new Map<string, { sets: number; tonnage: number }>();
  for (const s of sets) {
    const t = train.get(s.localDate) ?? { sets: 0, tonnage: 0 };
    const ex = EXERCISE_BY_ID.get(s.exerciseId);
    if (s.setType === "working" && ex?.pattern !== "cardio") {
      t.sets++;
      if (s.weightKg && s.reps) t.tonnage += s.weightKg * s.reps;
    }
    train.set(s.localDate, t);
  }

  // Day grid: from the first date of nutrition/weight/training data (steps go back years, but aren't the anchor).
  const anchors = [wRows[0]?.localDate, [...nut.keys()].sort()[0], setRows[0]?.localDate].filter(Boolean) as string[];
  const firstDataDate = anchors.length ? anchors.sort()[0] : null;
  const start = firstDataDate ?? addDays(today, -30);

  const defined = readPhases(db);
  const phases = defined.length ? defined : [implicitPhase(stored, start)];
  const currentPhase = phaseOn(phases, today);
  // Off-plan or a gap today → keep stored defaults for protein; rate isn't judged (see judgesRate).
  const settings: Settings = currentPhase ? { ...stored, phase: currentPhase.kind, ...currentPhase.targets } : { ...stored, phase: "off_plan" };

  const days: Day[] = dateRange(start, today).map((date) => {
    const n = nut.get(date);
    const logged = n != null && date < today;
    const t = train.get(date);
    return {
      date,
      weightKg: weighInMap.get(date) ?? null,
      trendKg: trend.get(date) ?? null,
      kcal: logged ? n.kcal : null,
      proteinG: logged ? n.p : null,
      carbsG: logged ? n.c : null,
      fatG: logged ? n.f : null,
      fiberG: logged ? n.fib : null,
      mealCount: n?.n ?? 0,
      isFast: logged && n.kcal < FAST_KCAL,
      steps: date < today ? steps.get(date) ?? null : null,
      trained: !!t,
      workingSets: t?.sets ?? 0,
      tonnageKg: t?.tonnage ?? 0,
      perfScore: perfByDate.get(date) ?? null,
    };
  });

  return {
    settings, phases, currentPhase, phaseOn: (d: string) => phaseOn(phases, d), today, days, byDate: new Map(days.map((d) => [d.date, d])), trend, weighIns: weighInMap, kcalByDay,
    sets, liftSessions, perf, muscleWeeks, mealsByDay, flaggedSets, importsCount, firstDataDate,
  };
}

export { RANGES, parseRange, type RangeDays } from "./range";
import type { RangeDays } from "./range";

/** Days in the selected window ending today. */
export function windowDays(ds: Dataset, range: RangeDays): Day[] {
  if (range === "all") return ds.days;
  const from = addDays(ds.today, -(range - 1));
  return ds.days.filter((d) => d.date >= from);
}
