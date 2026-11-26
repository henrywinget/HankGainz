import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/db/client";
import { importAppleHealthStream, importCsvText } from "@/ingest/importer";
import { buildDataset } from "@/lib/dataset";
import { buildDigestInput } from "@/insights/digest-input";
import { writeDigest, DigestError, DIGEST_MODEL, type Digest } from "@/insights/digest";
import { buildSnapshot } from "@/insights/snapshot";
import { generateInsights } from "@/insights/rules";
import { writeSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/config/settings";
import { gPerKgToGPerLb, gPerLbToGPerKg } from "@/lib/units";
import { Readable } from "node:stream";
import { APPLE_HEALTH_XML, MFP_MEASUREMENT_CSV, MFP_NUTRITION_CSV, STRONG_CSV } from "./fixtures";

const NOW = new Date("2026-03-18T18:00:00Z"); // Wednesday → last complete week starts Mon 2026-03-09

async function seededDb() {
  const db = getDb(":memory:");
  importCsvText(db, "n.csv", MFP_NUTRITION_CSV);
  importCsvText(db, "m.csv", MFP_MEASUREMENT_CSV);
  importCsvText(db, "s.csv", STRONG_CSV);
  await importAppleHealthStream(db, "export.xml", Readable.from([Buffer.from(APPLE_HEALTH_XML)]), "crc32:9:9");
  return db;
}

const SAMPLE: Digest = {
  headline: "Solid week",
  verdict: "on_track",
  summary: "s",
  wins: ["a", "b", "c", "d"],
  realityChecks: [],
  focus: [1, 2, 3, 4].map((i) => ({ action: `do ${i}`, why: "because" })),
};

function fakeClient(response: Record<string, unknown>) {
  const calls: Record<string, unknown>[] = [];
  const client = { beta: { messages: { parse: async (params: Record<string, unknown>) => { calls.push(params); return response; } } } };
  return { client: client as unknown as Anthropic, calls };
}

describe("digest input (what leaves the machine)", () => {
  it("is aggregates only: no source/device names, notes or meal rows; hash is stable", async () => {
    const db = await seededDb();
    const input = buildDigestInput(buildDataset(db, NOW))!;
    expect(input.weekStart).toBe("2026-03-09");
    const json = JSON.stringify(input.payload);
    expect(json).not.toMatch(/Test Phone|sourceName|Breakfast|Dinner/); // device name, meal names
    expect(json).not.toContain('"typo"'); // Strong set note
    expect(json).not.toMatch(/1773|1400/); // flagged outlier set never reaches metrics
    expect((input.payload.weeks as unknown[]).length).toBeGreaterThan(0);
    expect(buildDigestInput(buildDataset(db, NOW))!.hash).toBe(input.hash);
  });
});

describe("writeDigest", () => {
  it("calls the default model with fallbacks + structured output, and trims lists to 3", async () => {
    const { client, calls } = fakeClient({ stop_reason: "end_turn", parsed_output: SAMPLE, model: DIGEST_MODEL, usage: { input_tokens: 1200, output_tokens: 300 } });
    const r = await writeDigest({ hello: "world" }, client);
    expect(r.digest.focus).toHaveLength(3);
    expect(r.digest.wins).toHaveLength(3);
    expect(r.inputTokens).toBe(1200);
    const p = calls[0] as { model: string; fallbacks: unknown; betas: string[]; output_config: { effort: string; format: unknown } };
    expect(p.model).toBe("claude-opus-5-5");
    expect(p.fallbacks).toBe("default");
    expect(p.betas).toContain("server-side-fallback-2026-07-01");
    expect(p.output_config.effort).toBe("medium");
    expect(p.output_config.format).toBeTruthy();
  });

  it("surfaces refusals and unparseable output as DigestError", async () => {
    await expect(writeDigest({}, fakeClient({ stop_reason: "refusal", parsed_output: null, model: DIGEST_MODEL }).client)).rejects.toBeInstanceOf(DigestError);
    await expect(writeDigest({}, fakeClient({ stop_reason: "end_turn", parsed_output: null, model: DIGEST_MODEL }).client)).rejects.toBeInstanceOf(DigestError);
  });
});

describe("Hank's preferences in the coach", () => {
  it("never flags non-focus muscles, and judges sessions against the planned 3–4/week", async () => {
    const db = await seededDb();
    // Only chest in focus: triceps/front delts (trained lightly here) must not be flagged.
    writeSettings(db, { ...DEFAULT_SETTINGS, focusMuscles: ["chest"], timeZone: "America/Chicago" });
    const ds = buildDataset(db, NOW);
    const ins = generateInsights(ds, buildSnapshot(ds, 14));
    const vol = ins.filter((i) => i.id.startsWith("volume"));
    for (const i of vol) expect(i.title).not.toMatch(/Triceps|Front delts|Calves|Side delts/);
    const consistency = ins.find((i) => i.id === "consistency");
    expect(consistency?.basis).toMatch(/plan 3–4\/week/);
  });

  it("converts protein targets between g/kg (stored) and g/lb (shown)", () => {
    expect(gPerKgToGPerLb(2.2)).toBeCloseTo(0.998, 2); // the classic "1 g per lb"
    expect(gPerKgToGPerLb(1.6)).toBeCloseTo(0.726, 2);
    expect(gPerLbToGPerKg(gPerKgToGPerLb(1.8))).toBeCloseTo(1.8, 10);
  });
});
