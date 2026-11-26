import { eq } from "drizzle-orm";
import type { DB } from "@/db/client";
import { settings as settingsTable } from "@/db/schema";
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from "@/config/settings";

export function readSettings(db: DB): Settings {
  const rows = db.select().from(settingsTable).all();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const merged = { ...DEFAULT_SETTINGS, ...stored };
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export function writeSettings(db: DB, next: Settings) {
  const valid = settingsSchema.parse(next);
  db.transaction((tx) => {
    for (const [key, value] of Object.entries(valid)) {
      // null means "use the default / auto"; store nothing for it.
      if (value === null) tx.delete(settingsTable).where(eq(settingsTable.key, key)).run();
      else tx.insert(settingsTable).values({ key, value }).onConflictDoUpdate({ target: settingsTable.key, set: { value } }).run();
    }
  });
}
