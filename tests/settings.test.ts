import { describe, expect, it } from "vitest";
import { getDb } from "@/db/client";
import { readSettings, writeSettings } from "@/lib/settings";
import { DEFAULT_SETTINGS } from "@/config/settings";

describe("settings", () => {
  it("round-trips, including a null (auto) calorie target", () => {
    const db = getDb(":memory:");
    expect(readSettings(db)).toEqual(DEFAULT_SETTINGS);
    writeSettings(db, { ...DEFAULT_SETTINGS, kcalTarget: 3100, stepGoal: 10000 });
    expect(readSettings(db).kcalTarget).toBe(3100);
    writeSettings(db, { ...readSettings(db), kcalTarget: null }); // regression: used to violate NOT NULL
    expect(readSettings(db).kcalTarget).toBeNull();
    expect(readSettings(db).stepGoal).toBe(10000);
  });
});
