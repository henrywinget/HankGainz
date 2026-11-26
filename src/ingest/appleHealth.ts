import { SaxesParser } from "saxes";
import type { Readable } from "node:stream";

const STEP_TYPE = "HKQuantityTypeIdentifierStepCount";

export interface StepsResult {
  /** local date → total steps */
  days: Map<string, number>;
  recordsRead: number;
  warnings: string[];
}

/**
 * Streams an Apple Health export.xml and sums StepCount records per local day.
 * The local date is the wall-clock date in the record's own offset (e.g. "2026-11-25 15:29:23 -0600").
 * Never buffers the file (it's 200 MB+).
 */
export async function parseAppleHealthSteps(stream: Readable): Promise<StepsResult> {
  const days = new Map<string, number>();
  let recordsRead = 0;
  const parser = new SaxesParser({ xmlns: false });
  let parseError: Error | null = null;

  parser.on("opentag", (tag) => {
    if (tag.name !== "Record") return;
    const a = tag.attributes as Record<string, string>;
    if (a.type !== STEP_TYPE) return;
    const value = Number(a.value);
    const start = a.startDate;
    if (!start || !Number.isFinite(value)) return;
    recordsRead++;
    const d = start.slice(0, 10);
    days.set(d, (days.get(d) ?? 0) + value);
  });
  parser.on("error", (e) => {
    parseError = e;
  });

  stream.setEncoding("utf8");
  for await (const chunk of stream) {
    parser.write(chunk as string);
    if (parseError) throw parseError;
  }
  parser.close();
  if (parseError) throw parseError;

  for (const [d, v] of days) days.set(d, Math.round(v));
  const warnings: string[] = [];
  if (recordsRead === 0) warnings.push("No StepCount records found in this export");
  return { days, recordsRead, warnings };
}
