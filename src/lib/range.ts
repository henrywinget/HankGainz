export const RANGES = [7, 14, 30, 60, 90, 180, 365] as const;
export type RangeDays = (typeof RANGES)[number] | "all";

export function parseRange(v: string | string[] | undefined, fallback: RangeDays = 30): RangeDays {
  const s = Array.isArray(v) ? v[0] : v;
  if (s === "all") return "all";
  const n = Number(s);
  return (RANGES as readonly number[]).includes(n) ? (n as RangeDays) : fallback;
}

export const rangeLabel = (r: RangeDays) => (r === "all" ? "all time" : `last ${r} days`);
