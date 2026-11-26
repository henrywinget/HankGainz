import { describe, expect, it } from "vitest";
import { Readable } from "node:stream";
import { isNotNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { meals, workoutSets, dailySteps } from "@/db/schema";
import { importAppleHealthStream, importCsvText } from "@/ingest/importer";
import { correctSet } from "@/ingest/corrections";
import { kgToLb, lbToKg } from "@/lib/units";
import { APPLE_HEALTH_XML, MFP_EXERCISE_CSV, MFP_EXERCISE_STRENGTH_CSV, MFP_NUTRITION_CSV, STRONG_CSV } from "./fixtures";
import { buildDataset } from "@/lib/dataset";

const freshDb = () => getDb(":memory:");

describe("importer", () => {
  it("is idempotent: identical files are skipped", () => {
    const db = freshDb();
    expect(importCsvText(db, "n.csv", MFP_NUTRITION_CSV).status).toBe("imported");
    expect(importCsvText(db, "n-copy.csv", MFP_NUTRITION_CSV).status).toBe("skipped_duplicate");
    expect(db.select().from(meals).all()).toHaveLength(3);
  });

  it("overlapping exports replace their date range instead of duplicating", () => {
    const db = freshDb();
    importCsvText(db, "a.csv", MFP_NUTRITION_CSV);
    const edited = MFP_NUTRITION_CSV.replace("2026-03-01,Breakfast,500.0", "2026-03-01,Breakfast,550.0");
    expect(importCsvText(db, "b.csv", edited).status).toBe("imported");
    const rows = db.select().from(meals).all();
    expect(rows).toHaveLength(3);
    expect(rows.find((m) => m.meal === "Breakfast" && m.localDate === "2026-03-01")?.kcal).toBe(550);
  });

  it("set corrections survive a full re-import", () => {
    const db = freshDb();
    importCsvText(db, "s.csv", STRONG_CSV);
    const flagged = db.select().from(workoutSets).where(isNotNull(workoutSets.flagReason)).all();
    expect(flagged).toHaveLength(1);
    correctSet(db, flagged[0].id, "set_weight", { weightKg: lbToKg(140) });

    // Re-import (slightly different bytes so it isn't skipped as a duplicate)
    importCsvText(db, "s2.csv", STRONG_CSV + "\n");
    const all = db.select().from(workoutSets).all();
    expect(all.filter((s) => s.flagReason)).toHaveLength(0);
    const fixed = all.find((s) => s.corrected)!;
    expect(kgToLb(fixed.weightKg!)).toBeCloseTo(140);
  });

  it("MFP strength sets fill pre-Strong days; Strong wins on shared days; re-imports don't clobber each other", () => {
    const db = freshDb();
    expect(importCsvText(db, "ex-cardio.csv", MFP_EXERCISE_CSV).status).toBe("ignored");
    expect(importCsvText(db, "ex.csv", MFP_EXERCISE_STRENGTH_CSV).status).toBe("imported");
    importCsvText(db, "s.csv", STRONG_CSV); // Strong has 2026-03-02 and 03-05
    const rows = db.select().from(workoutSets).all();
    expect(rows.filter((r) => r.source === "mfp")).toHaveLength(11); // Strong import didn't delete MFP rows

    const ds = buildDataset(db, new Date("2026-03-10T18:00:00Z"));
    const benchMar2 = ds.sets.filter((s) => s.localDate === "2026-03-02" && s.exerciseId === "bench");
    expect(benchMar2.every((s) => s.workoutName !== "MyFitnessPal")).toBe(true); // MFP duplicates dropped
    expect(ds.sets.some((s) => s.localDate === "2026-02-20" && s.workoutName === "MyFitnessPal")).toBe(true);
    expect(ds.byDate.get("2026-02-20")?.trained).toBe(true);
  });

  it("imports steps and skips the same export identity", async () => {
    const db = freshDb();
    const a = await importAppleHealthStream(db, "export.xml", Readable.from([Buffer.from(APPLE_HEALTH_XML)]), "crc32:1:1");
    expect(a.rowsWritten).toBe(2);
    const b = await importAppleHealthStream(db, "export.xml", Readable.from([Buffer.from(APPLE_HEALTH_XML)]), "crc32:1:1");
    expect(b.status).toBe("skipped_duplicate");
    expect(db.select().from(dailySteps).all()).toHaveLength(2);
  });
});
