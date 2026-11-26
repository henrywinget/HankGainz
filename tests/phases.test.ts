import { describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { importCsvText } from "@/ingest/importer";
import { buildDataset } from "@/lib/dataset";
import { phaseOn, readPhases, savePhase, startNewPhase, validatePhase } from "@/lib/phases";
import { buildSnapshot } from "@/insights/snapshot";
import { generateInsights } from "@/insights/rules";
import { allPhaseReports } from "@/metrics/phases";
import { addDays } from "@/lib/dates";

/** Synthetic year: gain → cut → off-plan regain → cut, with daily weigh-ins and 2,500 kcal days. */
function seasonDb() {
  const db = getDb(":memory:");
  const segs: [string, number, number][] = [["2026-01-01", 59, 0.08], ["2026-03-01", 120, -0.1], ["2026-06-29", 42, 0.25], ["2026-08-10", 30, -0.12]];
  const rows: string[] = ["Date,Weight"], meals: string[] = ["Date,Meal,Calories,Fat (g),Carbohydrates (g),Protein (g)"];
  let w = 160;
  for (const [start, days, perDay] of segs) for (let i = 0; i < days; i++) {
    const d = addDays(start, i);
    w += perDay;
    rows.push(`${d},${w.toFixed(2)}`);
    meals.push(`${d},Dinner,2500,80,250,${w > 0 ? 170 : 0}`);
  }
  importCsvText(db, "m.csv", rows.join("\n"));
  importCsvText(db, "n.csv", meals.join("\n"));
  savePhase(db, { kind: "lean_gain", start: "2026-01-01", end: "2026-02-28" });
  savePhase(db, { kind: "cut", start: "2026-03-01", end: "2026-06-28" });
  savePhase(db, { kind: "off_plan", start: "2026-06-29", end: "2026-08-09", note: "vacation" });
  savePhase(db, { kind: "cut", start: "2026-08-10", end: null });
  return db;
}
const NOW = new Date("2026-09-08T18:00:00Z");

describe("goal phases", () => {
  it("rejects overlaps and bad ranges", () => {
    const db = seasonDb();
    const list = readPhases(db);
    expect(validatePhase({ kind: "maintain", start: "2026-02-15", end: "2026-03-10" }, list)).toMatch(/Overlaps/);
    expect(validatePhase({ kind: "maintain", start: "2026-05-01", end: "2026-04-01" }, list)).toMatch(/before the start/);
    expect(validatePhase({ kind: "maintain", start: "2025-06-01", end: "2025-12-31" }, list)).toBeNull();
  });

  it("finds the phase for a date; 'goal changed' closes the ongoing phase", () => {
    const db = seasonDb();
    expect(phaseOn(readPhases(db), "2026-07-04")?.kind).toBe("off_plan");
    expect(startNewPhase(db, { kind: "maintain", start: "2026-09-01" })).toBeNull();
    const list = readPhases(db);
    expect(list.find((p) => p.start === "2026-08-10")?.end).toBe("2026-08-31");
    expect(list.at(-1)).toMatchObject({ kind: "maintain", end: null });
    expect(startNewPhase(db, { kind: "cut", start: "2026-08-20" })).toMatch(/after the current one/);
  });

  it("current settings follow the current phase; rate is measured within it only", () => {
    const ds = buildDataset(seasonDb(), NOW);
    expect(ds.settings.phase).toBe("cut");
    expect(ds.settings.proteinMinGPerKg).toBe(2.3); // cut preset
    const s = buildSnapshot(ds, 30);
    expect(s.phaseDay).toBe(30);
    expect(s.phaseRate!.windowDays).toBe(28);
    expect(s.phaseRate!.pctPerMonth).toBeLessThan(0); // the off-plan regain before Aug 10 doesn't leak in
    const rate = generateInsights(ds, s).find((i) => i.id === "weight.rate")!;
    expect(rate.title).not.toMatch(/losing, not gaining/);
  });

  it("report cards grade each phase against its own goal and measure the regain", () => {
    const reports = allPhaseReports(buildDataset(seasonDb(), NOW));
    expect(reports.map((r) => r.phase.kind)).toEqual(["lean_gain", "cut", "off_plan", "cut"]);
    const [gain, cut, off] = reports;
    expect(gain.ratePctPerMonth!).toBeGreaterThan(0);
    expect(cut.ratePctPerMonth!).toBeLessThan(0);
    expect(off.verdict).toBeNull(); // off plan isn't graded
    expect(off.regainOfPrevious!).toBeGreaterThan(0.5);
    expect(off.regainOfPrevious!).toBeLessThan(1.2);
  });

  it("a brand-new phase isn't judged on rate until it has 14 days", () => {
    const db = seasonDb();
    startNewPhase(db, { kind: "lean_gain", start: "2026-09-01" });
    const ds = buildDataset(db, NOW);
    const s = buildSnapshot(ds, 30);
    expect(s.phaseRate).toBeNull();
    expect(generateInsights(ds, s).find((i) => i.id === "weight.rate")?.title).toMatch(/days old/);
  });
});
