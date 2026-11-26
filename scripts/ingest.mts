/**
 * Imports every export under data/raw/ (or the paths given as args).
 *   pnpm ingest                → scan data/raw/**
 *   pnpm ingest path/to/file   → import specific files
 * Safe to re-run: identical files are skipped, overlapping exports replace their date range.
 */
import fs from "node:fs";
import path from "node:path";
import { getDb } from "../src/db/client";
import { importFilePath, type ImportOutcome } from "../src/ingest/importer";

const root = path.join(process.cwd(), "data", "raw");

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return e.name.startsWith(".") ? [] : [p];
  });
}

// Zips first, so loose copies of the same files are skipped as duplicates.
const files = (process.argv.length > 2 ? process.argv.slice(2) : walk(root)).sort((a, b) => Number(b.endsWith(".zip")) - Number(a.endsWith(".zip")));

const db = getDb();
const all: ImportOutcome[] = [];
for (const f of files) {
  const t = Date.now();
  try {
    const out = await importFilePath(db, f);
    for (const o of out) {
      all.push(o);
      const icon = { imported: "✔", skipped_duplicate: "↺", ignored: "·", error: "✖" }[o.status];
      console.log(`${icon} ${o.fileName}  [${o.source}] ${o.status}  read=${o.rowsRead} written=${o.rowsWritten}  ${Date.now() - t}ms${o.message ? `  (${o.message})` : ""}`);
      for (const w of o.warnings) console.log(`    ⚠ ${w}`);
    }
  } catch (e) {
    console.error(`✖ ${path.basename(f)}: ${(e as Error).message}`);
    process.exitCode = 1;
  }
}
console.log(`\n${all.filter((o) => o.status === "imported").length} imported, ${all.filter((o) => o.status === "skipped_duplicate").length} duplicates skipped.`);
