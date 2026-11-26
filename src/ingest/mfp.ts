import Papa from "papaparse";
import { z } from "zod";
import { lbToKg } from "@/lib/units";
import { flagWeightOutliers, type ParseResult, type StrongSet } from "./strong";
import { exerciseIdFor } from "@/config/exercises";

export interface MealRow {
  localDate: string;
  meal: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  satFatG: number | null;
  fiberG: number | null;
  sugarG: number | null;
  sodiumMg: number | null;
  potassiumMg: number | null;
  cholesterolMg: number | null;
}

export interface WeighInRow {
  localDate: string;
  weightKg: number;
}

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const req = z.coerce.number().refine(Number.isFinite);
const opt = z
  .string()
  .optional()
  .transform((s) => (s == null || s.trim() === "" ? null : Number(s)))
  .refine((n) => n === null || Number.isFinite(n));

const nutritionSchema = z.object({
  Date: date,
  Meal: z.string().min(1),
  Calories: req,
  "Fat (g)": req,
  "Carbohydrates (g)": req,
  "Protein (g)": req,
  "Saturated Fat": opt,
  Fiber: opt,
  Sugar: opt,
  "Sodium (mg)": opt,
  Potassium: opt,
  Cholesterol: opt,
});

export function parseMfpNutritionCsv(text: string): ParseResult<MealRow> {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const warnings: string[] = [];
  const byKey = new Map<string, MealRow>();
  let bad = 0;

  for (const raw of parsed.data) {
    const r = nutritionSchema.safeParse(raw);
    if (!r.success) {
      bad++;
      continue;
    }
    const d = r.data;
    const row: MealRow = {
      localDate: d.Date,
      meal: d.Meal.trim(),
      kcal: d.Calories,
      proteinG: d["Protein (g)"],
      carbsG: d["Carbohydrates (g)"],
      fatG: d["Fat (g)"],
      satFatG: d["Saturated Fat"],
      fiberG: d.Fiber,
      sugarG: d.Sugar,
      sodiumMg: d["Sodium (mg)"],
      potassiumMg: d.Potassium,
      cholesterolMg: d.Cholesterol,
    };
    // MFP can emit the same meal twice for a day; sum them.
    const key = `${row.localDate}|${row.meal}`;
    const prev = byKey.get(key);
    if (prev) {
      for (const f of ["kcal", "proteinG", "carbsG", "fatG", "satFatG", "fiberG", "sugarG", "sodiumMg", "potassiumMg", "cholesterolMg"] as const) {
        const a = prev[f], b = row[f];
        (prev as unknown as Record<string, number | null>)[f] = a == null && b == null ? null : (a ?? 0) + (b ?? 0);
      }
    } else byKey.set(key, row);
  }
  if (bad) warnings.push(`${bad} row(s) failed validation and were skipped`);
  return { rows: [...byKey.values()], rowsRead: parsed.data.length, warnings };
}

/**
 * MFP Exercise Summary → strength sets. Only rows with Type "Strength" carry sets/reps/weight;
 * cardio rows (incl. "Strength training (weight lifting…)" session entries synced from other apps) are ignored.
 * Each row = one exercise on one day: `Sets` sets of `Reps Per Set` at `Pounds` (or `Kilograms`).
 */
export function parseMfpExerciseCsv(text: string): ParseResult<StrongSet> & { cardioRows: number } {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const rows: StrongSet[] = [];
  const warnings: string[] = [];
  const index = new Map<string, number>();
  let cardioRows = 0, bad = 0;

  for (const raw of parsed.data) {
    if ((raw.Type ?? "").trim().toLowerCase() !== "strength") {
      cardioRows++;
      continue;
    }
    const d = raw.Date?.trim();
    const sets = Math.round(Number(raw.Sets));
    const reps = Math.round(Number(raw["Reps Per Set"]));
    const lb = raw.Pounds != null && raw.Pounds !== "" ? Number(raw.Pounds) : null;
    const kg = raw.Kilograms != null && raw.Kilograms !== "" ? Number(raw.Kilograms) : null;
    const name = (raw.Exercise ?? "").replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
    if (!date.safeParse(d).success || !name || !(sets > 0) || sets > 50) {
      bad++;
      continue;
    }
    const weightKg = lb != null && lb > 0 ? lbToKg(lb) : kg != null && kg > 0 ? kg : null;
    for (let i = 0; i < sets; i++) {
      const key = `${d}|${name}`;
      const n = (index.get(key) ?? 0) + 1;
      index.set(key, n);
      rows.push({
        workoutStart: `${d}T00:00:00`,
        localDate: d,
        workoutName: "MyFitnessPal",
        workoutDurationS: raw["Exercise Minutes"] ? Number(raw["Exercise Minutes"]) * 60 || null : null,
        exerciseRaw: name,
        exerciseId: exerciseIdFor(name),
        setIndex: n,
        setType: "working",
        weightKg,
        reps: reps > 0 ? reps : null,
        distanceM: null,
        durationS: null,
        notes: raw.Note?.trim() || null,
        flagReason: null,
      });
    }
  }
  flagWeightOutliers(rows);
  if (bad) warnings.push(`${bad} strength row(s) failed validation and were skipped`);
  const unmapped = [...new Set(rows.filter((r) => r.exerciseId.startsWith("unmapped:")).map((r) => r.exerciseRaw))];
  if (unmapped.length) warnings.push(`Unmapped MFP exercises (add aliases in src/config/exercises.ts): ${unmapped.join(", ")}`);
  if (rows.some((r) => r.flagReason)) warnings.push(`${rows.filter((r) => r.flagReason).length} set(s) flagged as possible typos, review on the Import page`);
  return { rows, rowsRead: parsed.data.length, warnings, cardioRows };
}

const measurementSchema = z.object({ Date: date, Weight: req });

export function parseMfpMeasurementCsv(text: string, unit: "lb" | "kg" = "lb"): ParseResult<WeighInRow> {
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const warnings: string[] = [];
  const byDate = new Map<string, WeighInRow>();
  let bad = 0;
  for (const raw of parsed.data) {
    const r = measurementSchema.safeParse(raw);
    if (!r.success || r.data.Weight <= 0) {
      bad++;
      continue;
    }
    byDate.set(r.data.Date, { localDate: r.data.Date, weightKg: unit === "lb" ? lbToKg(r.data.Weight) : r.data.Weight });
  }
  if (bad) warnings.push(`${bad} row(s) failed validation and were skipped`);
  return { rows: [...byDate.values()], rowsRead: parsed.data.length, warnings };
}
