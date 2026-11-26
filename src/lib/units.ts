export const LB_PER_KG = 2.20462262185;
export const KG_PER_LB = 0.45359237;
/** Approximate energy content of 1 kg of body-mass change (mixed tissue). */
export const KCAL_PER_KG = 7700;

export const lbToKg = (lb: number) => lb * KG_PER_LB;
/** Protein targets are stored in g/kg (the unit research uses) but shown in g/lb. */
export const gPerKgToGPerLb = (x: number) => x / LB_PER_KG;
export const gPerLbToGPerKg = (x: number) => x * LB_PER_KG;
export const fmtGPerLb = (gPerKg: number, digits = 2) => gPerKgToGPerLb(gPerKg).toFixed(digits);
export const kgToLb = (kg: number) => kg * LB_PER_KG;

export function fmtLb(kg: number | null | undefined, digits = 1): string {
  if (kg == null || Number.isNaN(kg)) return "—";
  return `${kgToLb(kg).toFixed(digits)}`;
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return Math.round(n).toLocaleString("en-US");
}

export function fmtSigned(n: number, digits = 1): string {
  const s = n.toFixed(digits);
  return n > 0 ? `+${s}` : s;
}
