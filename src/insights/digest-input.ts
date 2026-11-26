import crypto from "node:crypto";
import type { Dataset } from "@/lib/dataset";
import { buildSnapshot } from "./snapshot";
import { generateInsights } from "./rules";
import { addDays, weekStart as isoWeekStart } from "@/lib/dates";
import { kgToLb, gPerKgToGPerLb } from "@/lib/units";
import { mean } from "@/metrics/stats";
import { EXERCISE_BY_ID, KEY_LIFTS, MUSCLE_LABEL } from "@/config/exercises";
import { PHASE_LABEL } from "@/config/settings";
import { GUIDELINES } from "@/guidelines";
import { allPhaseReports } from "@/metrics/phases";

/**
 * The ONLY data that leaves the machine for the AI digest (CLAUDE.md rule 2):
 * weekly aggregates, current targets, rule-based insights and guideline text.
 * No raw files, meal names, notes, device/source names, or anything identifying.
 */
export interface DigestInput {
  weekStart: string;
  hash: string;
  payload: Record<string, unknown>;
}

const r1 = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? null : Math.round(n * 10) / 10);
const r0 = (n: number | null | undefined) => (n == null || Number.isNaN(n) ? null : Math.round(n));
const WEEKS = 8;

export function buildDigestInput(ds: Dataset): DigestInput | null {
  const s = ds.settings;
  const lastWeek = addDays(isoWeekStart(ds.today), -7); // most recent *complete* ISO week
  const firstWeek = addDays(lastWeek, -7 * (WEEKS - 1));
  const weekStarts = Array.from({ length: WEEKS }, (_, i) => addDays(firstWeek, i * 7)).filter((w) => ds.byDate.has(w) || ds.byDate.has(addDays(w, 6)));
  if (!weekStarts.length) return null;

  const weeks = weekStarts.map((w) => {
    const days = Array.from({ length: 7 }, (_, i) => ds.byDate.get(addDays(w, i))).filter((d) => d != null);
    const logged = days.filter((d) => d.kcal != null);
    const steps = days.filter((d) => d.steps != null);
    const t0 = ds.trend.get(addDays(w, -1)), t1 = ds.trend.get(addDays(w, 6));
    const muscles = ds.muscleWeeks.get(w);
    const prs: string[] = [];
    for (const [id, xs] of ds.liftSessions) for (const x of xs) if (x.isPr && x.date >= w && x.date <= addDays(w, 6)) prs.push(`${EXERCISE_BY_ID.get(id)?.name} ${Math.round(kgToLb(x.e1rmKg))} lb e1RM`);
    return {
      weekStart: w,
      trendEndLb: r1(t1 != null ? kgToLb(t1) : null),
      trendChangeLb: r1(t0 != null && t1 != null ? kgToLb(t1 - t0) : null),
      loggedDays: logged.length,
      fastDays: logged.filter((d) => d.isFast).length,
      avgKcal: r0(logged.length ? mean(logged.map((d) => d.kcal!)) : null),
      avgProteinG: r0(logged.length ? mean(logged.map((d) => d.proteinG!)) : null),
      proteinGPerLb: (() => {
        const xs = logged.filter((d) => d.trendKg && !d.isFast).map((d) => d.proteinG! / kgToLb(d.trendKg!));
        return xs.length ? Math.round(mean(xs) * 100) / 100 : null;
      })(),
      avgSteps: r0(steps.length ? mean(steps.map((d) => d.steps!)) : null),
      sessions: days.filter((d) => d.workingSets > 0).length,
      workingSets: days.reduce((a, d) => a + d.workingSets, 0),
      prs,
      focusMusclesUnderTarget: s.focusMuscles.filter((m) => (muscles?.get(m) ?? 0) < s.setsMinPerMuscle).map((m) => MUSCLE_LABEL[m]),
    };
  });

  const snap = buildSnapshot(ds, 30);
  const insights = generateInsights(ds, snap).map((i) => ({ tone: i.tone, title: i.title, detail: i.body }));

  const keyLifts = KEY_LIFTS.map((l) => {
    const xs = ds.liftSessions.get(l.id) ?? [];
    if (!xs.length) return null;
    const best = xs.reduce((a, b) => (b.e1rmKg > a.e1rmKg ? b : a));
    const recent = xs.filter((x) => x.date >= addDays(ds.today, -28));
    const stall = snap.stalls.find((x) => x.liftId === l.id);
    return {
      lift: l.name,
      bestE1rmLb: Math.round(kgToLb(best.e1rmKg)),
      bestOn: best.date,
      best28dE1rmLb: recent.length ? Math.round(kgToLb(Math.max(...recent.map((x) => x.e1rmKg)))) : null,
      weeksSinceBest: stall?.weeksSincePr ?? 0,
    };
  }).filter(Boolean);

  const payload = {
    units: "lb, kcal, grams; protein targets in g per lb of bodyweight",
    reviewWeek: { start: lastWeek, end: addDays(lastWeek, 6) },
    athlete: {
      goal: PHASE_LABEL[s.phase],
      currentPhase: ds.currentPhase ? { goal: PHASE_LABEL[ds.currentPhase.kind], since: ds.currentPhase.start, day: snap.phaseDay } : null,
      phaseHistory: allPhaseReports(ds).map((r) => ({
        goal: PHASE_LABEL[r.phase.kind],
        from: r.from,
        to: r.ongoing ? "ongoing" : r.to,
        trendChangeLb: r.trendStartKg != null && r.trendEndKg != null ? r1(kgToLb(r.trendEndKg - r.trendStartKg)) : null,
        ratePctPerMonth: r.ratePctPerMonth != null ? Math.round(r.ratePctPerMonth * 100) / 100 : null,
        verdict: r.verdict?.label ?? null,
        avgKcal: r0(r.avgKcal),
        regainOfPreviousCutPct: r.regainOfPrevious != null ? Math.round(r.regainOfPrevious * 100) : null,
      })),
      targets: {
        bodyweightChangePctPerMonth: [s.rateMinPctPerMonth, s.rateMaxPctPerMonth],
        proteinGPerLb: [gPerKgToGPerLb(s.proteinMinGPerKg), gPerKgToGPerLb(s.proteinMaxGPerKg)].map((x) => Math.round(x * 100) / 100),
        hardSetsPerFocusMusclePerWeek: [s.setsMinPerMuscle, s.setsMaxPerMuscle],
        sessionsPerWeek: [s.sessionsMinPerWeek, s.sessionsMaxPerWeek],
        dailySteps: s.stepGoal,
        dailyKcal: s.kcalTarget ?? (snap.targetKcal ? r0(snap.targetKcal / 10)! * 10 : null),
      },
      focusMuscles: s.focusMuscles.map((m) => MUSCLE_LABEL[m]),
      preferences: [
        "Compound-focused program; accessories only for arms (triceps, biceps). Low volume on side delts, calves, traps, forearms etc. is intentional, so don't flag it.",
        `Caps training at about ${s.sessionsMaxPerWeek} sessions/week and values short, efficient sessions.`,
        "Every logged nutrition day is accurate, including 0-kcal fast days and very large days. Don't question the logging.",
        "Rarely uses drop sets and avoids training to failure.",
      ],
    },
    current: {
      trendWeightLb: r1(snap.trendNowKg ? kgToLb(snap.trendNowKg) : null),
      rateWithinCurrentPhasePctPerMonth: snap.phaseRate ? Math.round(snap.phaseRate.pctPerMonth * 100) / 100 : null,
      rate14dPctPerMonth: snap.rate14 ? Math.round(snap.rate14.pctPerMonth * 100) / 100 : null,
      rateVerdict: snap.rateVerdict?.label ?? null,
      maintenanceKcal: snap.tdee ? r0(snap.tdee.kcal / 10)! * 10 : null,
      maintenanceConfidence: snap.tdee?.confidence ?? null,
      targetIntakeKcal: snap.targetKcal ? r0(snap.targetKcal / 10)! * 10 : null,
    },
    weeks,
    keyLifts,
    ruleBasedInsights: insights,
    guidelines: Object.values(GUIDELINES).map((g) => ({ id: g.id, grade: g.grade, summary: g.summary })),
  };

  const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return { weekStart: lastWeek, hash, payload };
}
