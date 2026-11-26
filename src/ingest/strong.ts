import Papa from "papaparse";
import { z } from "zod";
import { exerciseIdFor, normalizeName } from "@/config/exercises";
import { lbToKg } from "@/lib/units";
import { RULES } from "@/guidelines";

export interface StrongSet {
  workoutStart: string;
  localDate: string;
  workoutName: string;
  workoutDurationS: number | null;
  exerciseRaw: string;
  exerciseId: string;
  setIndex: number;
  setType: "working" | "warmup";
  weightKg: number | null;
  reps: number | null;
  distanceM: number | null;
  durationS: number | null;
  notes: string | null;
  flagReason: string | null;
}

export interface ParseResult<T> {
  rows: T[];
  rowsRead: number;
  warnings: string[];
}

const num = z
  .string()
  .optional()
  .transform((s) => (s == null || s.trim() === "" ? null : Number(s)))
  .refine((n) => n === null || Number.isFinite(n), "not a number");

const rowSchema = z.object({
  Date: z.string().regex(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/),
  "Workout Name": z.string(),
  Duration: z.string().optional().default(""),
  "Exercise Name": z.string().min(1),
  "Set Order": z.string(),
  Weight: num,
  Reps: num,
  Distance: num,
  Seconds: num,
  Notes: z.string().optional().nullable(),
});

/** "1h 6m" | "40m" | "1h" | "45s" → seconds */
export function parseDuration(s: string): number | null {
  const m = s.trim().match(/^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/);
  if (!m || (!m[1] && !m[2] && !m[3])) return null;
  return (Number(m[1] ?? 0) * 3600) + (Number(m[2] ?? 0) * 60) + Number(m[3] ?? 0);
}

export interface StrongOptions {
  /** Units configured in the Strong app. Hank uses lb. */
  weightUnit: "lb" | "kg";
  distanceUnit: "mi" | "km";
}

export function parseStrongCsv(text: string, opts: StrongOptions = { weightUnit: "lb", distanceUnit: "mi" }): ParseResult<StrongSet> {
  const delimiter = text.slice(0, text.indexOf("\n")).includes(";") ? ";" : ",";
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true, delimiter });
  const warnings: string[] = [];
  const rows: StrongSet[] = [];
  let bad = 0;

  for (const raw of parsed.data) {
    const setOrder = (raw["Set Order"] ?? "").trim();
    if (setOrder.toLowerCase() === "rest timer") continue;

    const r = rowSchema.safeParse(raw);
    if (!r.success) {
      bad++;
      continue;
    }
    const d = r.data;
    const marker = setOrder.toUpperCase();
    const isWarmup = marker === "W";
    // Drop ("D") and failure ("F") markers, if Strong ever exports them, are still working sets.
    const idx = isWarmup || marker === "D" || marker === "F" ? 0 : Number(setOrder);
    if (!isWarmup && !Number.isInteger(idx)) {
      warnings.push(`Unknown Set Order "${setOrder}" on ${d.Date} ${d["Exercise Name"]}, skipped`);
      continue;
    }

    const exerciseRaw = d["Exercise Name"].replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
    const weight = d.Weight && d.Weight > 0 ? d.Weight : null;
    const workoutStart = d.Date.replace(" ", "T").padEnd(19, ":00").slice(0, 19);

    rows.push({
      workoutStart,
      localDate: d.Date.slice(0, 10),
      workoutName: d["Workout Name"].trim(),
      workoutDurationS: parseDuration(d.Duration),
      exerciseRaw,
      exerciseId: exerciseIdFor(exerciseRaw),
      setIndex: 0, // assigned below
      setType: isWarmup ? "warmup" : "working",
      weightKg: weight == null ? null : opts.weightUnit === "lb" ? lbToKg(weight) : weight,
      reps: d.Reps && d.Reps > 0 ? Math.round(d.Reps) : null,
      distanceM: d.Distance && d.Distance > 0 ? d.Distance * (opts.distanceUnit === "mi" ? 1609.344 : 1000) : null,
      durationS: d.Seconds && d.Seconds > 0 ? d.Seconds : null,
      notes: d.Notes?.trim() || null,
      flagReason: null,
    });
  }

  // Assign stable per-(workout, exercise, setType) indexes in file order. Warm-ups ("W") have no number in the export.
  const counters = new Map<string, number>();
  for (const s of rows) {
    const k = `${s.workoutStart}|${s.exerciseRaw}|${s.setType}`;
    const n = (counters.get(k) ?? 0) + 1;
    counters.set(k, n);
    s.setIndex = n;
  }

  flagWeightOutliers(rows);

  if (bad) warnings.push(`${bad} row(s) failed validation and were skipped`);
  const unmapped = [...new Set(rows.filter((r) => r.exerciseId.startsWith("unmapped:")).map((r) => r.exerciseRaw))];
  if (unmapped.length) warnings.push(`Unmapped exercises (add to src/config/exercises.ts): ${unmapped.join(", ")}`);
  const flagged = rows.filter((r) => r.flagReason).length;
  if (flagged) warnings.push(`${flagged} set(s) flagged as possible typos, review on the Import page`);

  return { rows, rowsRead: parsed.data.length, warnings };
}

/** Flags working sets whose weight is far above that exercise's median, which catches typos like 1451 lb instead of 145. */
export function flagWeightOutliers(rows: StrongSet[]) {
  const byEx = new Map<string, number[]>();
  for (const r of rows) {
    if (r.weightKg == null) continue;
    const k = normalizeName(r.exerciseRaw);
    (byEx.get(k) ?? byEx.set(k, []).get(k)!).push(r.weightKg);
  }
  const medians = new Map<string, number>();
  for (const [k, ws] of byEx) {
    const s = [...ws].sort((a, b) => a - b);
    medians.set(k, s[Math.floor(s.length / 2)]);
  }
  for (const r of rows) {
    if (r.weightKg == null) continue;
    const med = medians.get(normalizeName(r.exerciseRaw))!;
    if (med > 0 && r.weightKg > med * RULES.outlier.strongWeightMultiple) {
      r.flagReason = `Weight is ${(r.weightKg / med).toFixed(1)}× this exercise's median, possible typo`;
    }
  }
}
