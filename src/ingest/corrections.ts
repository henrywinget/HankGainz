import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { setCorrections, workoutSets } from "@/db/schema";
import { applySetCorrections } from "./importer";

export type CorrectionAction = "set_weight" | "exclude" | "accept";

/** Save a correction for a Strong set (by row id) and apply it. Persisted by natural key, so it survives re-imports. */
export function correctSet(db: DB, setId: number, action: CorrectionAction, opts: { weightKg?: number; reason?: string } = {}) {
  const s = db.select().from(workoutSets).where(eq(workoutSets.id, setId)).get();
  if (!s) throw new Error(`Set ${setId} not found`);
  if (action === "set_weight" && (opts.weightKg == null || !(opts.weightKg > 0))) throw new Error("A positive weight is required");

  const values = {
    workoutStart: s.workoutStart,
    exerciseRaw: s.exerciseRaw,
    setType: s.setType,
    setIndex: s.setIndex,
    action,
    weightKg: action === "set_weight" ? opts.weightKg! : null,
    reason: opts.reason ?? null,
    createdAt: new Date().toISOString(),
  };
  db.insert(setCorrections)
    .values(values)
    .onConflictDoUpdate({
      target: [setCorrections.workoutStart, setCorrections.exerciseRaw, setCorrections.setType, setCorrections.setIndex],
      set: { action: values.action, weightKg: values.weightKg, reason: values.reason, createdAt: values.createdAt },
    })
    .run();
  applySetCorrections(db);
}
