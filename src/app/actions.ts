"use server";

import { refresh } from "next/cache";
import { getDb } from "@/db/client";
import { readSettings, writeSettings } from "@/lib/settings";
import { correctSet } from "@/ingest/corrections";
import { lbToKg, gPerLbToGPerKg } from "@/lib/units";
import { settingsSchema, type Settings } from "@/config/settings";
import { and, eq } from "drizzle-orm";
import { digests } from "@/db/schema";
import { buildDataset } from "@/lib/dataset";
import { buildDigestInput } from "@/insights/digest-input";
import { writeDigest, describeDigestError, hasApiCredentials } from "@/insights/digest";
import { savePhase, startNewPhase, deletePhase, type PhaseInput } from "@/lib/phases";

// The app binds to 127.0.0.1 only (see package.json), so there is no auth layer. Never expose it publicly.

export type ActionState = { ok: boolean; message: string } | null;

const num = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return v == null || v === "" ? null : Number(v);
};

const lbField = (fd: FormData, k: string) => {
  const v = num(fd, k);
  return v == null ? null : gPerLbToGPerKg(v);
};

export async function saveSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const db = getDb();
  const current = readSettings(db);
  // Phase, rate and protein targets live on goal phases (Goals page); keep the stored values untouched here.
  const next = {
    ...current,
    setsMinPerMuscle: num(fd, "setsMinPerMuscle") ?? current.setsMinPerMuscle,
    setsMaxPerMuscle: num(fd, "setsMaxPerMuscle") ?? current.setsMaxPerMuscle,
    stepGoal: num(fd, "stepGoal") ?? current.stepGoal,
    sessionsMinPerWeek: num(fd, "sessionsMinPerWeek") ?? current.sessionsMinPerWeek,
    sessionsMaxPerWeek: num(fd, "sessionsMaxPerWeek") ?? current.sessionsMaxPerWeek,
    focusMuscles: fd.get("focusMusclesSubmitted") ? (fd.getAll("focusMuscles").map(String) as Settings["focusMuscles"]) : current.focusMuscles,
    kcalTarget: num(fd, "kcalTarget"),
    timeZone: String(fd.get("timeZone") || current.timeZone),
  };

  const parsed = settingsSchema.safeParse(next);
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") };
  const s = parsed.data;
  if (s.rateMinPctPerMonth > s.rateMaxPctPerMonth || s.proteinMinGPerKg > s.proteinMaxGPerKg || s.setsMinPerMuscle > s.setsMaxPerMuscle || s.sessionsMinPerWeek > s.sessionsMaxPerWeek)
    return { ok: false, message: "Each minimum must be ≤ its maximum." };
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: s.timeZone });
  } catch {
    return { ok: false, message: `Unknown time zone "${s.timeZone}"` };
  }

  writeSettings(db, s);
  refresh();
  return { ok: true, message: "Saved" };
}

export async function fixSet(fd: FormData) {
  const id = Number(fd.get("id"));
  const action = String(fd.get("action"));
  const db = getDb();
  if (action === "set_weight") {
    const lb = Number(fd.get("weightLb"));
    if (!(lb > 0)) return;
    correctSet(db, id, "set_weight", { weightKg: lbToKg(lb), reason: `Corrected to ${lb} lb in app` });
  } else if (action === "exclude") {
    correctSet(db, id, "exclude", { reason: "Excluded in app" });
  } else if (action === "accept") {
    correctSet(db, id, "accept", { reason: "Confirmed correct in app" });
  }
  refresh();
}

/** Opt-in AI digest: sends aggregates only (see src/insights/digest-input.ts). Cached per week + input hash. */
export async function generateDigest(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (!hasApiCredentials()) return { ok: false, message: "Add ANTHROPIC_API_KEY to .env.local and restart the dev server." };
  const db = getDb();
  const input = buildDigestInput(buildDataset(db));
  if (!input) return { ok: false, message: "Need at least one complete week of data." };

  const force = fd.get("force") === "1";
  const cached = db.select().from(digests).where(and(eq(digests.weekStart, input.weekStart), eq(digests.inputHash, input.hash))).get();
  if (cached && !force) return { ok: true, message: "Already up to date. No new data since the last digest." };

  try {
    const r = await writeDigest(input.payload);
    const row = { weekStart: input.weekStart, inputHash: input.hash, createdAt: new Date().toISOString(), model: r.model, payload: input.payload, content: r.digest, inputTokens: r.inputTokens, outputTokens: r.outputTokens };
    db.insert(digests).values(row).onConflictDoUpdate({ target: [digests.weekStart, digests.inputHash], set: row }).run();
  } catch (e) {
    return { ok: false, message: describeDigestError(e) };
  }
  refresh();
  return { ok: true, message: "Digest written." };
}

// ── Goal phases ─────────────────────────────────────────────────────────

function phaseFromForm(fd: FormData): PhaseInput {
  const str = (k: string) => {
    const v = String(fd.get(k) ?? "").trim();
    return v === "" ? null : v;
  };
  return {
    kind: String(fd.get("kind")) as PhaseInput["kind"],
    start: String(fd.get("start") ?? ""),
    end: str("end"),
    note: str("note"),
    rateMinPctPerMonth: num(fd, "rateMinPctPerMonth"),
    rateMaxPctPerMonth: num(fd, "rateMaxPctPerMonth"),
    // Form is in g/lb; stored in g/kg.
    proteinMinGPerKg: lbField(fd, "proteinMinGPerLb"),
    proteinMaxGPerKg: lbField(fd, "proteinMaxGPerLb"),
  };
}

export async function savePhaseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = fd.get("id") ? Number(fd.get("id")) : null;
  const err = savePhase(getDb(), phaseFromForm(fd), id);
  if (err) return { ok: false, message: err };
  refresh();
  return { ok: true, message: id ? "Phase updated" : "Phase added" };
}

export async function startPhaseAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { end: _end, ...input } = phaseFromForm(fd);
  void _end;
  const err = startNewPhase(getDb(), input);
  if (err) return { ok: false, message: err };
  refresh();
  return { ok: true, message: "New phase started. Coaching now follows it." };
}

export async function deletePhaseAction(fd: FormData) {
  const id = Number(fd.get("id"));
  if (id) deletePhase(getDb(), id);
  refresh();
}
