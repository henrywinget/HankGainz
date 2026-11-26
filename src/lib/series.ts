import type { Day } from "./dataset";
import { kgToLb } from "./units";
import { rolling } from "@/metrics/stats";

const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

export const weightSeries = (days: Day[]) =>
  days.map((d) => ({ date: d.date, weight: d.weightKg == null ? null : r1(kgToLb(d.weightKg)), trend: d.trendKg == null ? null : r1(kgToLb(d.trendKg)) }));

export function caloriesSeries(days: Day[]) {
  const avg = rolling(days.map((d) => d.kcal), 7, 3);
  return days.map((d, i) => ({ date: d.date, kcal: d.kcal == null ? null : Math.round(d.kcal), avg7: avg[i] == null ? null : Math.round(avg[i]!), fast: d.isFast }));
}

export const macroSeries = (days: Day[]) =>
  days.map((d) => ({
    date: d.date,
    protein: d.proteinG == null ? null : Math.round(d.proteinG * 4),
    carbs: d.carbsG == null ? null : Math.round(d.carbsG * 4),
    fat: d.fatG == null ? null : Math.round(d.fatG * 9),
  }));

export const proteinSeries = (days: Day[]) =>
  days.map((d) => ({ date: d.date, gPerLb: d.proteinG != null && d.trendKg && !d.isFast ? Math.round((d.proteinG / kgToLb(d.trendKg)) * 100) / 100 : null }));

export function stepsSeries(days: Day[]) {
  const avg = rolling(days.map((d) => d.steps), 7, 3);
  return days.map((d, i) => ({ date: d.date, steps: d.steps, avg7: avg[i] == null ? null : Math.round(avg[i]!) }));
}
