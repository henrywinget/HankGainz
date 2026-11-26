import { z } from "zod";
import { MUSCLE_LABEL, type Muscle } from "./exercises";

const MUSCLES = Object.keys(MUSCLE_LABEL) as [Muscle, ...Muscle[]];

export const PHASES = ["lean_gain", "maintain", "cut", "off_plan"] as const;
export type Phase = (typeof PHASES)[number];

export const PHASE_LABEL: Record<Phase, string> = {
  lean_gain: "Lean gain",
  maintain: "Maintain",
  cut: "Cut",
  off_plan: "Off plan",
};

/** "Off plan" has no rate goal. The stretch is described, never scored as a failed bulk or cut. */
export const judgesRate = (p: Phase) => p !== "off_plan";

export const settingsSchema = z.object({
  phase: z.enum(PHASES),
  /** Target rate of bodyweight change, % of BW per month (negative for cut). */
  rateMinPctPerMonth: z.number().min(-8).max(5),
  rateMaxPctPerMonth: z.number().min(-8).max(5),
  proteinMinGPerKg: z.number().min(0.5).max(4),
  proteinMaxGPerKg: z.number().min(0.5).max(4),
  setsMinPerMuscle: z.number().int().min(0).max(40),
  setsMaxPerMuscle: z.number().int().min(1).max(50),
  /** Muscles held to the weekly-sets target. Others are shown but never nagged about (Hank: compound-focused, accessories only for arms). */
  focusMuscles: z.array(z.enum(MUSCLES)),
  sessionsMinPerWeek: z.number().min(0).max(14),
  /** Planned cap: Hank keeps it to ~4/week to limit gym time. */
  sessionsMaxPerWeek: z.number().min(1).max(14),
  stepGoal: z.number().int().min(1000).max(40000),
  /** Optional fixed calorie target; null => derived from adaptive TDEE + phase. */
  kcalTarget: z.number().int().min(800).max(8000).nullable(),
  timeZone: z.string(),
});

export type Settings = z.infer<typeof settingsSchema>;

/** Per-phase default targets (sourced from GUIDELINES.md). A goal phase can override any of them. */
export const PHASE_PRESETS: Record<Phase, Pick<Settings, "rateMinPctPerMonth" | "rateMaxPctPerMonth" | "proteinMinGPerKg" | "proteinMaxGPerKg">> = {
  lean_gain: { rateMinPctPerMonth: 0.5, rateMaxPctPerMonth: 1.0, proteinMinGPerKg: 1.6, proteinMaxGPerKg: 2.2 },
  maintain: { rateMinPctPerMonth: -0.5, rateMaxPctPerMonth: 0.5, proteinMinGPerKg: 1.6, proteinMaxGPerKg: 2.2 },
  // 0.5–1.0 %/week ≈ 2–4 %/month
  cut: { rateMinPctPerMonth: -4, rateMaxPctPerMonth: -2, proteinMinGPerKg: 2.3, proteinMaxGPerKg: 3.1 },
  // No rate goal (see judgesRate); protein falls back to the maintenance range.
  off_plan: { rateMinPctPerMonth: -0.5, rateMaxPctPerMonth: 0.5, proteinMinGPerKg: 1.6, proteinMaxGPerKg: 2.2 },
};

export const DEFAULT_SETTINGS: Settings = {
  phase: "lean_gain",
  ...PHASE_PRESETS.lean_gain,
  setsMinPerMuscle: 10,
  setsMaxPerMuscle: 20,
  // Muscles his compounds train (+ the arms he chooses to work). Side delts, calves, traps, forearms etc. are intentionally light.
  focusMuscles: ["chest", "front_delts", "triceps", "biceps", "lats", "upper_back", "quads", "hamstrings", "glutes"],
  sessionsMinPerWeek: 3,
  sessionsMaxPerWeek: 4,
  stepGoal: 8000,
  kcalTarget: null,
  timeZone: "America/Chicago",
};
