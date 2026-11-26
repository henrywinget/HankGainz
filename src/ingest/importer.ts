import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable } from "node:stream";
import yauzl from "yauzl";
import { and, between, eq, sql } from "drizzle-orm";
import type { DB } from "@/db/client";
import { imports, meals, weighIns, dailySteps, workoutSets, setCorrections } from "@/db/schema";
import { parseStrongCsv } from "./strong";
import { parseMfpNutritionCsv, parseMfpMeasurementCsv, parseMfpExerciseCsv } from "./mfp";
import { parseAppleHealthSteps } from "./appleHealth";

export type Source = "strong" | "mfp_nutrition" | "mfp_measurement" | "mfp_exercise" | "apple_health_steps";

export interface ImportOutcome {
  fileName: string;
  source: Source | "ignored" | "unknown";
  status: "imported" | "skipped_duplicate" | "ignored" | "error";
  rowsRead: number;
  rowsWritten: number;
  warnings: string[];
  message?: string;
}

const CHUNK = 400;
const nowIso = () => new Date().toISOString();
const sha256 = (buf: Buffer | string) => crypto.createHash("sha256").update(buf).digest("hex");

/** Identify a CSV by its header line. */
export function detectCsv(text: string): Source | "ignored" | "unknown" {
  const header = text.slice(0, 300).split(/\r?\n/)[0].replace(/^﻿/, "");
  if (/^Date[,;]Workout Name[,;]/.test(header)) return "strong";
  if (/^Date,Meal,Calories/.test(header)) return "mfp_nutrition";
  if (/^Date,Weight\b/.test(header)) return "mfp_measurement";
  if (/^Date,Exercise,Type/.test(header) || /Exercise Calories/.test(header)) return "mfp_exercise";
  return "unknown";
}

function alreadyImported(db: DB, source: Source, hash: string) {
  return db.select({ id: imports.id }).from(imports).where(and(eq(imports.source, source), eq(imports.sha256, hash))).get() != null;
}

function recordImport(db: DB, source: Source, fileName: string, hash: string, rowsRead: number, rowsWritten: number, warnings: string[]) {
  db.insert(imports)
    .values({ source, fileName, sha256: hash, importedAt: nowIso(), rowsRead, rowsWritten, warnings })
    .onConflictDoUpdate({ target: [imports.source, imports.sha256], set: { importedAt: nowIso(), rowsRead, rowsWritten, warnings } })
    .run();
}

function dateSpan(dates: string[]): [string, string] | null {
  if (!dates.length) return null;
  let min = dates[0], max = dates[0];
  for (const d of dates) {
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/** Re-apply manual fixes after any Strong import. */
export function applySetCorrections(db: DB) {
  const corrections = db.select().from(setCorrections).all();
  for (const c of corrections) {
    const match = and(
      eq(workoutSets.workoutStart, c.workoutStart),
      eq(workoutSets.exerciseRaw, c.exerciseRaw),
      eq(workoutSets.setType, c.setType as "working" | "warmup"),
      eq(workoutSets.setIndex, c.setIndex),
    );
    if (c.action === "exclude") db.delete(workoutSets).where(match).run();
    else if (c.action === "set_weight") db.update(workoutSets).set({ weightKg: c.weightKg, flagReason: null, corrected: true }).where(match).run();
    else db.update(workoutSets).set({ flagReason: null }).where(match).run();
  }
}

/** Import a CSV payload whose source is detected from its header. */
export function importCsvText(db: DB, fileName: string, text: string): ImportOutcome {
  const source = detectCsv(text);
  const base: ImportOutcome = { fileName, source, status: "ignored", rowsRead: 0, rowsWritten: 0, warnings: [] };
  if (source === "ignored") return { ...base, message: "Not used by HankGainz (e.g. MFP Exercise Summary)" };
  if (source === "unknown") return { ...base, status: "error", message: "Unrecognized file. Expected a Strong export or a MyFitnessPal Nutrition/Measurement CSV." };

  const hash = sha256(text);
  if (alreadyImported(db, source, hash)) return { ...base, status: "skipped_duplicate", message: "Identical file already imported" };

  if (source === "strong") {
    const r = parseStrongCsv(text);
    const span = dateSpan(r.rows.map((x) => x.localDate));
    db.transaction((tx) => {
      if (span) tx.delete(workoutSets).where(and(eq(workoutSets.source, "strong"), between(workoutSets.localDate, span[0], span[1]))).run();
      for (let i = 0; i < r.rows.length; i += CHUNK) tx.insert(workoutSets).values(r.rows.slice(i, i + CHUNK).map((x) => ({ ...x, source: "strong" as const }))).run();
    });
    applySetCorrections(db);
    recordImport(db, source, fileName, hash, r.rowsRead, r.rows.length, r.warnings);
    return { ...base, status: "imported", rowsRead: r.rowsRead, rowsWritten: r.rows.length, warnings: r.warnings };
  }

  if (source === "mfp_exercise") {
    const r = parseMfpExerciseCsv(text);
    if (!r.rows.length) {
      return { ...base, status: "ignored", rowsRead: r.rowsRead, message: `No strength sets in this file (${r.cardioRows} cardio/calorie entries, which HankGainz doesn't use)` };
    }
    const span = dateSpan(r.rows.map((x) => x.localDate));
    db.transaction((tx) => {
      if (span) tx.delete(workoutSets).where(and(eq(workoutSets.source, "mfp"), between(workoutSets.localDate, span[0], span[1]))).run();
      for (let i = 0; i < r.rows.length; i += CHUNK) tx.insert(workoutSets).values(r.rows.slice(i, i + CHUNK).map((x) => ({ ...x, source: "mfp" as const }))).run();
    });
    applySetCorrections(db);
    const warnings = [...r.warnings, "MFP sets only count on days without a Strong workout"];
    recordImport(db, source, fileName, hash, r.rowsRead, r.rows.length, warnings);
    return { ...base, status: "imported", rowsRead: r.rowsRead, rowsWritten: r.rows.length, warnings };
  }

  if (source === "mfp_nutrition") {
    const r = parseMfpNutritionCsv(text);
    const span = dateSpan(r.rows.map((x) => x.localDate));
    db.transaction((tx) => {
      if (span) tx.delete(meals).where(between(meals.localDate, span[0], span[1])).run();
      for (let i = 0; i < r.rows.length; i += CHUNK) tx.insert(meals).values(r.rows.slice(i, i + CHUNK)).run();
    });
    recordImport(db, source, fileName, hash, r.rowsRead, r.rows.length, r.warnings);
    return { ...base, status: "imported", rowsRead: r.rowsRead, rowsWritten: r.rows.length, warnings: r.warnings };
  }

  // mfp_measurement
  const r = parseMfpMeasurementCsv(text);
  const span = dateSpan(r.rows.map((x) => x.localDate));
  db.transaction((tx) => {
    if (span) tx.delete(weighIns).where(between(weighIns.localDate, span[0], span[1])).run();
    for (let i = 0; i < r.rows.length; i += CHUNK) tx.insert(weighIns).values(r.rows.slice(i, i + CHUNK)).run();
  });
  recordImport(db, source, fileName, hash, r.rowsRead, r.rows.length, r.warnings);
  return { ...base, status: "imported", rowsRead: r.rowsRead, rowsWritten: r.rows.length, warnings: r.warnings };
}

/** Stream an Apple Health export.xml and upsert daily step totals. */
export async function importAppleHealthStream(db: DB, fileName: string, stream: Readable, identity: string): Promise<ImportOutcome> {
  const source: Source = "apple_health_steps";
  const base: ImportOutcome = { fileName, source, status: "imported", rowsRead: 0, rowsWritten: 0, warnings: [] };
  if (alreadyImported(db, source, identity)) {
    stream.destroy();
    return { ...base, status: "skipped_duplicate", message: "Identical export already imported" };
  }
  const r = await parseAppleHealthSteps(stream);
  const rows = [...r.days.entries()].map(([localDate, steps]) => ({ localDate, steps }));
  db.transaction((tx) => {
    for (let i = 0; i < rows.length; i += CHUNK) {
      tx.insert(dailySteps)
        .values(rows.slice(i, i + CHUNK))
        .onConflictDoUpdate({ target: dailySteps.localDate, set: { steps: sql`excluded.steps` } })
        .run();
    }
  });
  recordImport(db, source, fileName, identity, r.recordsRead, rows.length, r.warnings);
  return { ...base, rowsRead: r.recordsRead, rowsWritten: rows.length, warnings: r.warnings };
}

/** Import a ZIP (MFP export or Apple Health export.zip) from a buffer or path. */
export async function importZip(db: DB, fileName: string, input: { path: string } | { buffer: Buffer }): Promise<ImportOutcome[]> {
  const zip = "path" in input
    ? await yauzl.openPromise(input.path, { lazyEntries: true })
    : await yauzl.fromBufferPromise(input.buffer, { lazyEntries: true });
  const outcomes: ImportOutcome[] = [];

  try {
    for await (const entry of zipEntries(zip)) {
      const name = entry.fileName;
      if (name.endsWith("/") || name.includes("__MACOSX")) continue;
      const label = `${fileName} › ${path.basename(name)}`;
      const lower = name.toLowerCase();

      if (lower.endsWith("export.xml") && !lower.includes("cda")) {
        const stream = await zip.openReadStreamPromise(entry);
        // Identity: CRC32 + size of the inner XML, so the same export zipped twice is still a duplicate.
        outcomes.push(await importAppleHealthStream(db, label, stream, `crc32:${entry.crc32}:${entry.uncompressedSize}`));
      } else if (lower.endsWith(".csv")) {
        const stream = await zip.openReadStreamPromise(entry);
        const text = (await streamToBuffer(stream)).toString("utf8");
        outcomes.push(importCsvText(db, label, text));
      }
    }
  } finally {
    zip.close();
  }
  if (!outcomes.length) outcomes.push({ fileName, source: "unknown", status: "error", rowsRead: 0, rowsWritten: 0, warnings: [], message: "ZIP had no recognizable export files" });
  return outcomes;
}

/** Import any supported file on disk. */
export async function importFilePath(db: DB, filePath: string): Promise<ImportOutcome[]> {
  const name = path.basename(filePath);
  const lower = name.toLowerCase();
  if (lower.endsWith(".zip")) return importZip(db, name, { path: filePath });
  if (lower.endsWith(".csv")) return [importCsvText(db, name, fs.readFileSync(filePath, "utf8"))];
  if (lower.endsWith(".xml")) {
    if (lower.includes("cda")) return [{ fileName: name, source: "ignored", status: "ignored", rowsRead: 0, rowsWritten: 0, warnings: [], message: "Clinical document export, not used" }];
    const stat = fs.statSync(filePath);
    const identity = await fileCrc32Identity(filePath, stat.size);
    return [await importAppleHealthStream(db, name, fs.createReadStream(filePath, { highWaterMark: 1 << 20 }), identity)];
  }
  return [{ fileName: name, source: "unknown", status: "ignored", rowsRead: 0, rowsWritten: 0, warnings: [], message: "Unsupported file type" }];
}

// ── helpers ──────────────────────────────────────────────────────────────

async function* zipEntries(zip: yauzl.ZipFile): AsyncGenerator<yauzl.Entry> {
  while (true) {
    const entry = await new Promise<yauzl.Entry | null>((resolve, reject) => {
      const onEntry = (e: yauzl.Entry) => { cleanup(); resolve(e); };
      const onEnd = () => { cleanup(); resolve(null); };
      const onErr = (err: Error) => { cleanup(); reject(err); };
      const cleanup = () => { zip.off("entry", onEntry); zip.off("end", onEnd); zip.off("error", onErr); };
      zip.on("entry", onEntry); zip.on("end", onEnd); zip.on("error", onErr);
      zip.readEntry();
    });
    if (!entry) return;
    yield entry;
  }
}

async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of stream) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

/** CRC32 of a file, matching the identity used for zipped exports (zlib.crc32, Node ≥ 22.2). */
async function fileCrc32Identity(filePath: string, size: number): Promise<string> {
  const zlib = await import("node:zlib");
  let crc = 0;
  for await (const chunk of fs.createReadStream(filePath, { highWaterMark: 1 << 20 })) crc = zlib.crc32(chunk as Buffer, crc);
  return `crc32:${crc >>> 0}:${size}`;
}
