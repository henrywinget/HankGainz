export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

export function median(xs: number[]): number {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export interface LinReg {
  slope: number;
  intercept: number;
  r2: number;
  n: number;
}

export function linreg(xs: number[], ys: number[]): LinReg | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  return { slope, intercept: my - slope * mx, r2: syy === 0 ? 0 : (sxy * sxy) / (sxx * syy), n };
}

export function pearson(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  return sxy / Math.sqrt(sxx * syy);
}

export type Strength = "none" | "weak" | "moderate" | "strong";
export function strengthOf(r: number): Strength {
  const a = Math.abs(r);
  if (a < 0.1) return "none";
  if (a < 0.3) return "weak";
  if (a < 0.5) return "moderate";
  return "strong";
}

/** Trailing rolling mean over non-null values within the window. */
export function rolling(values: (number | null)[], window: number, minPoints = 1): (number | null)[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v != null);
    return slice.length >= minPoints ? mean(slice) : null;
  });
}

export function zscore(values: (number | null)[]): (number | null)[] {
  const xs = values.filter((v): v is number => v != null);
  const m = mean(xs);
  const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
  return values.map((v) => (v == null || !sd ? null : (v - m) / sd));
}
