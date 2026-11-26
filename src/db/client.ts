// Server-side only (also used by the CLI importer, so no "server-only" import here).
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema>;

export const DB_PATH = process.env.HANKGAINZ_DB ?? path.join(process.cwd(), "data", "processed", "hankgainz.db");

const g = globalThis as unknown as { __hgDb?: DB };

/** Opens (and migrates) the local SQLite DB once per process. */
export function getDb(dbPath: string = DB_PATH): DB {
  if (dbPath === DB_PATH && g.__hgDb) return g.__hgDb;
  if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  if (dbPath === DB_PATH) g.__hgDb = db;
  return db;
}
