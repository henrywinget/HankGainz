import { describe, expect, it } from "vitest";
import { adaptiveTdee, classifyRate, ewmaTrend, rateVerdict, targetIntake, trendRate } from "@/metrics/body";
import { detectStalls, epley, keyLiftSessions, weeklyMuscleSets, type SetRow } from "@/metrics/training";
import { pearson, linreg, strengthOf } from "@/metrics/stats";
import { addDays, dateRange, weekStart } from "@/lib/dates";
import { DEFAULT_SETTINGS } from "@/config/settings";

const START = "2026-01-01";

/** Linear bodyweight: kg0 + slope * day, every day. */
function linearWeights(days: number, kg0: number, slopePerDay: number) {
  return new Map(Array.from({ length: days }, (_, i) => [addDays(START, i), kg0 + slopePerDay * i] as const));
}

describe("bodyweight trend", () => {
  it("EWMA carries through missing days", () => {
    const w = new Map([["2026-01-01", 80], ["2026-01-04", 82]]);
    const t = ewmaTrend(w, "2026-01-05");
    expect(t.get("2026-01-02")).toBe(80);
    expect(t.get("2026-01-04")).toBeCloseTo(80.2);
    expect(t.get("2026-01-05")).toBeCloseTo(80.2);
  });

  it("recovers the rate of a steady gain (%BW/month)", () => {
    // 75 kg gaining 0.6 kg / 30.44 days ≈ 0.8 %/mo
    const slope = 0.6 / 30.44;
    const w = linearWeights(120, 75, slope);
    const end = addDays(START, 119);
    const t = ewmaTrend(w, end);
    const r = trendRate(t, w, end, 28)!;
    const expected = ((slope * 30.44) / t.get(end)!) * 100;
    expect(r.pctPerMonth).toBeCloseTo(expected, 1);
    expect(classifyRate(r.pctPerMonth, DEFAULT_SETTINGS)).toBe("on_target");
  });

  it("classifies bands relative to the target, phase-aware", () => {
    const s = { rateMinPctPerMonth: 0.5, rateMaxPctPerMonth: 1 };
    expect(classifyRate(2.0, s)).toBe("far_above");
    expect(classifyRate(1.2, s)).toBe("above");
    expect(classifyRate(0.2, s)).toBe("below");
    expect(classifyRate(-0.5, s)).toBe("far_below");
    expect(rateVerdict("far_above", "lean_gain", 2).tone).toBe("bad");
    expect(rateVerdict("far_below", "cut", -6).label).toMatch(/too fast/);
    // A cut that's still losing (just slowly) is a heads-up; only ≥ 0 is "stalled".
    expect(rateVerdict("far_above", "cut", -1).tone).toBe("warn");
    expect(rateVerdict("far_above", "cut", 0.2).label).toMatch(/stalled/);
    expect(rateVerdict("on_target", "off_plan", 3).label).toBe("No rate goal");
  });

  it("adaptive TDEE backs out maintenance from intake + trend change", () => {
    // Eat 3000/day while gaining 0.25 kg/week → surplus ≈ 0.25*7700/7 = 275 → TDEE ≈ 2725
    const slope = 0.25 / 7;
    const w = linearWeights(90, 75, slope);
    const end = addDays(START, 89);
    const t = ewmaTrend(w, end);
    const kcal = new Map(dateRange(START, end).map((d) => [d, 3000]));
    const tdee = adaptiveTdee(end, t, kcal)!;
    expect(tdee.kcal).toBeGreaterThan(2650);
    expect(tdee.kcal).toBeLessThan(2800);
    expect(tdee.confidence).toBe("high");
    // fast days are real intake: 0-kcal days lower the average
    kcal.set(addDays(end, -3), 0);
    expect(adaptiveTdee(end, t, kcal)!.avgIntake).toBeLessThan(3000);
  });

  it("target intake adds the surplus for the middle of the target rate", () => {
    const kcal = targetIntake(2800, 75, { rateMinPctPerMonth: 0.5, rateMaxPctPerMonth: 1 });
    // 0.75% of 75 kg = 0.5625 kg/mo → ≈ 142 kcal/day
    expect(kcal - 2800).toBeCloseTo(142, -1);
  });
});

const set = (localDate: string, exerciseId: string, weightKg: number | null, reps: number, setType: "working" | "warmup" = "working"): SetRow => ({
  localDate, workoutStart: `${localDate}T18:00:00`, workoutName: "W", workoutDurationS: 3600, exerciseId, exerciseRaw: exerciseId, setType, weightKg, reps, durationS: null,
});

describe("training metrics", () => {
  it("Epley e1RM ignores sets above 10 reps", () => {
    expect(epley(100, 1)).toBe(100);
    expect(epley(100, 10)).toBeCloseTo(133.33, 1);
    expect(epley(100, 12)).toBeNull();
  });

  it("flags PRs, skips warm-ups, adds bodyweight for pull-ups", () => {
    const sets = [
      set("2026-01-01", "bench", 100, 5), set("2026-01-01", "bench", 140, 5, "warmup"),
      set("2026-01-04", "bench", 102.5, 5), set("2026-01-08", "bench", 100, 5),
      set("2026-01-04", "pullup", 10, 5),
    ];
    const s = keyLiftSessions(sets, () => 80);
    const bench = s.get("bench")!;
    expect(bench.map((x) => x.isPr)).toEqual([false, true, false]);
    expect(bench[0].e1rmKg).toBeCloseTo(100 * (1 + 5 / 30));
    expect(s.get("pullup")![0].bestSet.weightKg).toBe(90);
  });

  it("detects a stall only for lifts still being trained", () => {
    const sets = [set("2026-01-01", "bench", 110, 5), ...[7, 14, 21, 28, 35].map((d) => set(addDays("2026-01-01", d), "bench", 105, 5))];
    const stalls = detectStalls(keyLiftSessions(sets, () => null), "2026-02-06");
    expect(stalls).toHaveLength(1);
    expect(stalls[0].weeksSincePr).toBe(5);
    expect(detectStalls(keyLiftSessions(sets, () => null), "2026-04-01")).toHaveLength(0); // not trained recently
  });

  it("counts fractional sets per muscle per ISO week", () => {
    const wk = weeklyMuscleSets([set("2026-01-05", "bench", 100, 5), set("2026-01-06", "bench", 100, 5), set("2026-01-06", "stairmaster", null, 0)]);
    const m = wk.get(weekStart("2026-01-05"))!;
    expect(m.get("chest")).toBe(2);
    expect(m.get("triceps")).toBe(1);
    expect(m.size).toBe(3); // chest, front_delts, triceps; cardio ignored
  });
});

describe("stats", () => {
  it("pearson and linreg agree on a perfect line", () => {
    const xs = [1, 2, 3, 4, 5], ys = xs.map((x) => 2 * x + 1);
    expect(pearson(xs, ys)).toBeCloseTo(1);
    expect(linreg(xs, ys)!.slope).toBeCloseTo(2);
    expect(strengthOf(-0.35)).toBe("moderate");
  });
});
