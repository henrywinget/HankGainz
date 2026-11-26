import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { parseDuration, parseStrongCsv } from "@/ingest/strong";
import { parseMfpExerciseCsv, parseMfpMeasurementCsv, parseMfpNutritionCsv } from "@/ingest/mfp";
import { parseAppleHealthSteps } from "@/ingest/appleHealth";
import { detectCsv } from "@/ingest/importer";
import { kgToLb } from "@/lib/units";
import { APPLE_HEALTH_XML, MFP_EXERCISE_CSV, MFP_EXERCISE_STRENGTH_CSV, MFP_MEASUREMENT_CSV, MFP_NUTRITION_CSV, STRONG_CSV } from "./fixtures";

describe("Strong parser", () => {
  const r = parseStrongCsv(STRONG_CSV);

  it("drops Rest Timer rows and keeps warm-ups as warmup sets", () => {
    expect(r.rows.some((x) => x.durationS === 120 && x.exerciseRaw.startsWith("Bench"))).toBe(false);
    const warm = r.rows.filter((x) => x.setType === "warmup");
    expect(warm).toHaveLength(1);
    expect(warm[0].setIndex).toBe(1);
  });

  it("converts lb to kg and back without drift", () => {
    const set = r.rows.find((x) => x.setType === "working" && x.exerciseRaw === "Bench Press (Barbell)")!;
    expect(kgToLb(set.weightKg!)).toBeCloseTo(135, 6);
  });

  it("normalizes names (trailing spaces, curly apostrophes) and maps exercises", () => {
    expect(r.rows.find((x) => x.exerciseRaw === "Stair master")?.exerciseId).toBe("stairmaster");
    expect(r.rows.find((x) => x.exerciseRaw === "Farmer's Carry")?.exerciseId).toBe("farmers_carry");
    expect(r.rows.find((x) => x.exerciseRaw === "Pull Up")?.weightKg).toBeCloseTo(25 * 0.45359237);
  });

  it("parses cardio durations and workout durations", () => {
    expect(r.rows.find((x) => x.exerciseId === "stairmaster")?.durationS).toBe(1200);
    expect(r.rows[0].workoutDurationS).toBe(3900);
    expect(parseDuration("40m")).toBe(2400);
    expect(parseDuration("1h")).toBe(3600);
    expect(parseDuration("nonsense")).toBeNull();
  });

  it("flags obvious weight typos instead of trusting them", () => {
    const flagged = r.rows.filter((x) => x.flagReason);
    expect(flagged).toHaveLength(1);
    expect(kgToLb(flagged[0].weightKg!)).toBeCloseTo(1400);
    expect(r.warnings.join(" ")).toMatch(/flagged/);
  });
});

describe("MyFitnessPal parsers", () => {
  it("sums duplicate meals and keeps 0-kcal fast days", () => {
    const r = parseMfpNutritionCsv(MFP_NUTRITION_CSV);
    const dinner = r.rows.find((x) => x.localDate === "2026-03-01" && x.meal === "Dinner")!;
    expect(dinner.kcal).toBe(1000);
    expect(dinner.proteinG).toBe(70);
    const fast = r.rows.find((x) => x.localDate === "2026-03-02")!;
    expect(fast.kcal).toBe(0);
  });

  it("reads weigh-ins in lb", () => {
    const r = parseMfpMeasurementCsv(MFP_MEASUREMENT_CSV);
    expect(r.rows).toHaveLength(2);
    expect(kgToLb(r.rows[0].weightKg)).toBeCloseTo(160);
  });
});

describe("MFP exercise parser", () => {
  it("expands Strength rows into sets and ignores cardio rows", () => {
    const r = parseMfpExerciseCsv(MFP_EXERCISE_STRENGTH_CSV);
    expect(r.cardioRows).toBe(1);
    const benchFeb20 = r.rows.filter((x) => x.localDate === "2026-02-20" && x.exerciseId === "bench");
    expect(benchFeb20.map((x) => x.setIndex)).toEqual([1, 2, 3, 4]); // two entries same day keep unique indexes
    expect(kgToLb(benchFeb20[3].weightKg!)).toBeCloseTo(135);
    expect(r.rows.filter((x) => x.exerciseId === "squat")).toHaveLength(2);
    expect(r.warnings.join(" ")).toMatch(/Mystery Machine Press/);
  });

  it("returns no rows for a cardio-only export", () => {
    expect(parseMfpExerciseCsv(MFP_EXERCISE_CSV).rows).toHaveLength(0);
  });
});

describe("source detection", () => {
  it("identifies each CSV by header", () => {
    expect(detectCsv(STRONG_CSV)).toBe("strong");
    expect(detectCsv(MFP_NUTRITION_CSV)).toBe("mfp_nutrition");
    expect(detectCsv(MFP_MEASUREMENT_CSV)).toBe("mfp_measurement");
    expect(detectCsv(MFP_EXERCISE_CSV)).toBe("mfp_exercise");
    expect(detectCsv("foo,bar\n1,2")).toBe("unknown");
  });
});

describe("Apple Health steps parser", () => {
  it("sums StepCount per local start date and ignores other record types", async () => {
    // Feed in small chunks to exercise streaming across tag boundaries.
    const chunks = APPLE_HEALTH_XML.match(/[\s\S]{1,37}/g)!;
    const r = await parseAppleHealthSteps(Readable.from(chunks.map((c) => Buffer.from(c))));
    expect(r.recordsRead).toBe(3);
    expect(r.days.get("2026-03-01")).toBe(1500);
    expect(r.days.get("2026-03-02")).toBe(4000);
  });
});
