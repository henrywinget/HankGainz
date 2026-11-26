import { asc, eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { phases as phasesTable } from "@/db/schema";
import { PHASES, PHASE_PRESETS, type Phase, type Settings } from "@/config/settings";
import { addDays, daysBetween } from "./dates";

export interface PhaseTargets {
  rateMinPctPerMonth: number;
  rateMaxPctPerMonth: number;
  proteinMinGPerKg: number;
  proteinMaxGPerKg: number;
}

export interface GoalPhase {
  id: number | null; // null = implicit (no phases defined yet)
  kind: Phase;
  start: string;
  /** null = ongoing */
  end: string | null;
  note: string | null;
  targets: PhaseTargets;
  /** which targets were overridden vs the kind's preset */
  overridden: boolean;
}

export interface PhaseInput {
  kind: Phase;
  start: string;
  end: string | null;
  note?: string | null;
  rateMinPctPerMonth?: number | null;
  rateMaxPctPerMonth?: number | null;
  proteinMinGPerKg?: number | null;
  proteinMaxGPerKg?: number | null;
}

type Row = typeof phasesTable.$inferSelect;

function resolve(row: Row): GoalPhase {
  const p = PHASE_PRESETS[row.kind];
  const targets = {
    rateMinPctPerMonth: row.rateMinPctPerMonth ?? p.rateMinPctPerMonth,
    rateMaxPctPerMonth: row.rateMaxPctPerMonth ?? p.rateMaxPctPerMonth,
    proteinMinGPerKg: row.proteinMinGPerKg ?? p.proteinMinGPerKg,
    proteinMaxGPerKg: row.proteinMaxGPerKg ?? p.proteinMaxGPerKg,
  };
  const overridden = [row.rateMinPctPerMonth, row.rateMaxPctPerMonth, row.proteinMinGPerKg, row.proteinMaxGPerKg].some((v) => v != null);
  return { id: row.id, kind: row.kind, start: row.startDate, end: row.endDate, note: row.note, targets, overridden };
}

export function readPhases(db: DB): GoalPhase[] {
  return db.select().from(phasesTable).orderBy(asc(phasesTable.startDate)).all().map(resolve);
}

/** The phase covering `date`, or null if none does (gap / before the first phase). */
export function phaseOn(list: GoalPhase[], date: string): GoalPhase | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i];
    if (p.start <= date && (p.end == null || date <= p.end)) return p;
  }
  return null;
}

/** When no phases exist, fall back to the legacy single-goal settings as one ongoing phase. */
export function implicitPhase(settings: Settings, from: string): GoalPhase {
  return {
    id: null, kind: settings.phase, start: from, end: null, note: null, overridden: false,
    targets: {
      rateMinPctPerMonth: settings.rateMinPctPerMonth, rateMaxPctPerMonth: settings.rateMaxPctPerMonth,
      proteinMinGPerKg: settings.proteinMinGPerKg, proteinMaxGPerKg: settings.proteinMaxGPerKg,
    },
  };
}

export const phaseDays = (p: GoalPhase, today: string) => daysBetween(p.start, p.end && p.end < today ? p.end : today) + 1;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates one phase against the others (excluding `selfId`). Returns an error message or null. */
export function validatePhase(input: PhaseInput, others: GoalPhase[], selfId?: number | null): string | null {
  if (!PHASES.includes(input.kind)) return "Unknown phase type";
  if (!DATE.test(input.start)) return "Start date is required";
  if (input.end != null && !DATE.test(input.end)) return "End date must be a date or blank (ongoing)";
  if (input.end != null && input.end < input.start) return "End date is before the start date";
  const pairs: [number | null | undefined, number | null | undefined, string][] = [
    [input.rateMinPctPerMonth, input.rateMaxPctPerMonth, "rate"],
    [input.proteinMinGPerKg, input.proteinMaxGPerKg, "protein"],
  ];
  for (const [lo, hi, name] of pairs) if (lo != null && hi != null && lo > hi) return `The ${name} minimum must be ≤ the maximum`;

  const end = input.end ?? "9999-12-31";
  for (const o of others) {
    if (o.id === selfId) continue;
    const oEnd = o.end ?? "9999-12-31";
    if (input.start <= oEnd && o.start <= end) {
      return `Overlaps the ${o.kind.replace("_", " ")} phase starting ${o.start}${o.end ? ` (ends ${o.end})` : " (ongoing)"}`;
    }
  }
  return null;
}

const toRow = (i: PhaseInput) => ({
  kind: i.kind, startDate: i.start, endDate: i.end, note: i.note?.trim() || null,
  rateMinPctPerMonth: i.rateMinPctPerMonth ?? null, rateMaxPctPerMonth: i.rateMaxPctPerMonth ?? null,
  proteinMinGPerKg: i.proteinMinGPerKg ?? null, proteinMaxGPerKg: i.proteinMaxGPerKg ?? null,
});

export function savePhase(db: DB, input: PhaseInput, id?: number | null): string | null {
  const err = validatePhase(input, readPhases(db), id);
  if (err) return err;
  if (id) db.update(phasesTable).set(toRow(input)).where(eq(phasesTable.id, id)).run();
  else db.insert(phasesTable).values(toRow(input)).run();
  return null;
}

/**
 * Start a new phase today-ish: closes the ongoing phase the day before `start` and opens a new one.
 * This is the "my goal changed" button.
 */
export function startNewPhase(db: DB, input: Omit<PhaseInput, "end">): string | null {
  const list = readPhases(db);
  const ongoing = list.find((p) => p.end == null);
  if (ongoing && ongoing.start >= input.start) return "The new phase must start after the current one began";
  // Validate against the list as it will be after closing the ongoing phase, then write both changes together.
  const after = list.map((p) => (p === ongoing ? { ...p, end: addDays(input.start, -1) } : p));
  const err = validatePhase({ ...input, end: null }, after);
  if (err) return err;
  db.transaction((tx) => {
    if (ongoing?.id) tx.update(phasesTable).set({ endDate: addDays(input.start, -1) }).where(eq(phasesTable.id, ongoing.id)).run();
    tx.insert(phasesTable).values(toRow({ ...input, end: null })).run();
  });
  return null;
}

export function deletePhase(db: DB, id: number) {
  db.delete(phasesTable).where(eq(phasesTable.id, id)).run();
}
