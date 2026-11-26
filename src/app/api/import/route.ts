import fs from "node:fs";
import path from "node:path";
import { getDb } from "@/db/client";
import { importFilePath, type ImportOutcome } from "@/ingest/importer";

const ALLOWED = /\.(zip|csv|xml)$/i;
const MAX_BYTES = 1024 * 1024 * 1024; // 1 GB

/**
 * Upload one or more exports (multipart field "files").
 * Each file is saved immutably under data/raw/uploads/ and then imported.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  if (!files.length) return Response.json({ error: "No files uploaded" }, { status: 400 });

  const dir = path.join(process.cwd(), "data", "raw", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const db = getDb();
  const results: ImportOutcome[] = [];

  for (const file of files) {
    const safe = path.basename(file.name).replace(/[^\w.\- ]+/g, "_");
    if (!ALLOWED.test(safe)) {
      results.push({ fileName: safe, source: "unknown", status: "error", rowsRead: 0, rowsWritten: 0, warnings: [], message: "Only .zip, .csv or .xml files" });
      continue;
    }
    if (file.size > MAX_BYTES) {
      results.push({ fileName: safe, source: "unknown", status: "error", rowsRead: 0, rowsWritten: 0, warnings: [], message: "File too large (1 GB max)" });
      continue;
    }
    const dest = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}__${safe}`);
    fs.writeFileSync(dest, Buffer.from(await file.arrayBuffer()));
    let outcomes: ImportOutcome[];
    try {
      outcomes = await importFilePath(db, dest);
    } catch (e) {
      outcomes = [{ fileName: safe, source: "unknown", status: "error", rowsRead: 0, rowsWritten: 0, warnings: [], message: (e as Error).message }];
    }
    // Keep only uploads that contributed data; duplicates and rejects don't need an archived copy.
    if (!outcomes.some((o) => o.status === "imported")) fs.rmSync(dest, { force: true });
    results.push(...outcomes);
  }
  return Response.json({ results });
}
