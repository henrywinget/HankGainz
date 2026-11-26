import { EXERCISE_BY_ID, KEY_LIFTS, type Muscle } from "@/config/exercises";
import { RULES } from "@/guidelines";
import { addDays, weekStart } from "@/lib/dates";

export interface SetRow {
  localDate: string;
  workoutStart: string;
  workoutName: string;
  workoutDurationS: number | null;
  exerciseId: string;
  exerciseRaw: string;
  setType: "working" | "warmup";
  weightKg: number | null;
  reps: number | null;
  durationS: number | null;
}

/** Epley estimated 1RM; null when outside the reliable rep range. */
export function epley(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !(reps >= 1) || reps > RULES.e1rm.maxReps) return null;
  return reps === 1 ? weightKg : weightKg * (1 + reps / 30);
}

/** Effective load: bodyweight moves add the lifter's bodyweight to the logged (added) weight. */
export function effectiveLoad(s: SetRow, bodyweightKg: number | null): number | null {
  const ex = EXERCISE_BY_ID.get(s.exerciseId);
  if (ex?.load === "bodyweight") return bodyweightKg == null ? null : bodyweightKg + (s.weightKg ?? 0);
  return s.weightKg;
}

export interface LiftSession {
  date: string;
  e1rmKg: number;
  bestSet: { weightKg: number; reps: number };
  isPr: boolean;
}

/** Best e1RM per session for each key lift, with PR flags (strictly better than all previous sessions). */
export function keyLiftSessions(sets: SetRow[], bodyweightOn: (date: string) => number | null): Map<string, LiftSession[]> {
  const out = new Map<string, LiftSession[]>();
  for (const lift of KEY_LIFTS) {
    const byDate = new Map<string, LiftSession>();
    for (const s of sets) {
      if (s.exerciseId !== lift.id || s.setType !== "working" || s.reps == null) continue;
      const load = effectiveLoad(s, bodyweightOn(s.localDate));
      if (load == null) continue;
      const e = epley(load, s.reps);
      if (e == null) continue;
      const prev = byDate.get(s.localDate);
      if (!prev || e > prev.e1rmKg) byDate.set(s.localDate, { date: s.localDate, e1rmKg: e, bestSet: { weightKg: load, reps: s.reps }, isPr: false });
    }
    const sessions = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
    let best = 0;
    for (const x of sessions) {
      if (x.e1rmKg > best + 1e-6) {
        x.isPr = best > 0; // first session isn't a "PR"
        best = x.e1rmKg;
      }
    }
    out.set(lift.id, sessions);
  }
  return out;
}

export interface StallInfo {
  liftId: string;
  weeksSincePr: number;
  lastPrDate: string;
  sessionsSince: number;
}

export function detectStalls(sessions: Map<string, LiftSession[]>, today: string): StallInfo[] {
  const out: StallInfo[] = [];
  for (const [liftId, xs] of sessions) {
    if (!xs.length) continue;
    const last = xs.at(-1)!;
    if (last.date < addDays(today, -14)) continue; // not currently training it
    // The all-time best session (earliest one, if tied) is the last PR.
    const ref = xs.reduce((a, b) => (b.e1rmKg > a.e1rmKg + 1e-6 ? b : a));
    const weeks = (Date.parse(today) - Date.parse(ref.date)) / (7 * 86_400_000);
    if (weeks >= RULES.stall.weeks) out.push({ liftId, weeksSincePr: Math.floor(weeks), lastPrDate: ref.date, sessionsSince: xs.filter((x) => x.date > ref.date).length });
  }
  return out;
}

/** Fractional hard sets per muscle per ISO week (primary = 1, secondary = 0.5; warm-ups and cardio excluded). */
export function weeklyMuscleSets(sets: SetRow[]): Map<string, Map<Muscle, number>> {
  const out = new Map<string, Map<Muscle, number>>();
  for (const s of sets) {
    if (s.setType !== "working") continue;
    const ex = EXERCISE_BY_ID.get(s.exerciseId);
    if (!ex || ex.pattern === "cardio") continue;
    const wk = weekStart(s.localDate);
    const m = out.get(wk) ?? out.set(wk, new Map()).get(wk)!;
    for (const p of ex.primary) m.set(p, (m.get(p) ?? 0) + 1);
    for (const p of ex.secondary) m.set(p, (m.get(p) ?? 0) + 0.5);
  }
  return out;
}

export interface SessionPerf {
  date: string;
  score: number; // 100 = matched recent best; >100 = beat it
  lifts: number;
}

/**
 * Session performance index: for each key lift trained that day, best e1RM ÷ best e1RM over the previous 60 days.
 * Averaged across lifts. Only sessions with ≥1 key lift that has history.
 */
export function sessionPerformance(sessions: Map<string, LiftSession[]>, lookbackDays = 60): SessionPerf[] {
  const byDate = new Map<string, number[]>();
  for (const xs of sessions.values()) {
    for (let i = 0; i < xs.length; i++) {
      const from = addDays(xs[i].date, -lookbackDays);
      let ref = 0;
      for (let j = 0; j < i; j++) if (xs[j].date >= from) ref = Math.max(ref, xs[j].e1rmKg);
      if (ref > 0) (byDate.get(xs[i].date) ?? byDate.set(xs[i].date, []).get(xs[i].date)!).push((xs[i].e1rmKg / ref) * 100);
    }
  }
  return [...byDate.entries()]
    .map(([date, r]) => ({ date, score: r.reduce((a, b) => a + b, 0) / r.length, lifts: r.length }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
