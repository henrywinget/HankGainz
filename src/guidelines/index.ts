/**
 * Evidence-based guidelines: the ONLY place recommendation thresholds live.
 * Mirrors docs/GUIDELINES.md. Change that doc first, then this file, then tests.
 */
export type Grade = "A" | "B" | "C";

export interface Guideline {
  id: string;
  title: string;
  summary: string;
  grade: Grade;
  source: string;
  url?: string;
}

export const GUIDELINES = {
  "rate.leanGain.intermediate": {
    id: "rate.leanGain.intermediate",
    title: "Lean-gain rate",
    summary: "Intermediate lifters: gain about 0.5–1.0% of bodyweight per month.",
    grade: "C",
    source: "Common evidence-based coaching frameworks (beginner 1–1.5%, intermediate 0.5–1%, advanced 0.25–0.5% BW/month)",
    url: "https://fitnessvolt.com/weight-gain-bulking-guide/",
  },
  "rate.surplus.small": {
    id: "rate.surplus.small",
    title: "Small surpluses win",
    summary: "In trained lifters, a ~5% surplus built muscle about as well as 15%, with less fat gain.",
    grade: "B",
    source: "8-week RCT, 21 trained lifters (Sports Medicine – Open, 2023). Small, short study.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10620361/",
  },
  "rate.cut.max": {
    id: "rate.cut.max",
    title: "Max cut rate",
    summary: "When cutting, keep losses around 0.5–1.0% of bodyweight per week to protect muscle.",
    grade: "C",
    source: "Common evidence-based coaching guidance",
  },
  "protein.daily.gain": {
    id: "protein.daily.gain",
    title: "Daily protein",
    summary: "1.4–2.0 g/kg/day (≈ 0.64–0.91 g/lb) is enough to build and maintain muscle for most people who train.",
    grade: "A",
    source: "ISSN Position Stand: Protein and Exercise (Jäger et al., 2017)",
    url: "https://pubmed.ncbi.nlm.nih.gov/28642676/",
  },
  "protein.daily.cut": {
    id: "protein.daily.cut",
    title: "Protein in a deficit",
    summary: "2.3–3.1 g/kg/day (≈ 1.04–1.41 g/lb) may better preserve lean mass in trained people who are dieting.",
    grade: "A",
    source: "ISSN Position Stand: Protein and Exercise (Jäger et al., 2017)",
    url: "https://pubmed.ncbi.nlm.nih.gov/28642676/",
  },
  "protein.perMeal": {
    id: "protein.perMeal",
    title: "Protein per meal",
    summary: "About 0.25 g/kg (≈ 0.11 g/lb, or 20–40 g) per meal, spread every 3–4 hours.",
    grade: "A",
    source: "ISSN Position Stand: Protein and Exercise (Jäger et al., 2017)",
    url: "https://pubmed.ncbi.nlm.nih.gov/28642676/",
  },
  "volume.doseResponse": {
    id: "volume.doseResponse",
    title: "Volume dose-response",
    summary: "More weekly sets per muscle → more growth, with diminishing returns.",
    grade: "A",
    source: "Schoenfeld, Ogborn & Krieger 2017 meta-analysis; Pelland et al. (preprint, fractional set counting)",
    url: "https://pubmed.ncbi.nlm.nih.gov/27433992/",
  },
  "volume.target.weekly": {
    id: "volume.target.weekly",
    title: "Weekly sets per muscle",
    summary: "Roughly 10–20 hard sets per muscle group per week is a practical target for trained lifters.",
    grade: "B",
    source: "Systematic review (2022) suggesting 12–20 weekly sets for trained men",
    url: "https://pubmed.ncbi.nlm.nih.gov/35291645/",
  },
  "steps.daily": {
    id: "steps.daily",
    title: "Daily steps",
    summary: "Health benefits rise with steps and level off around 8,000–10,000/day for adults under 60.",
    grade: "A",
    source: "Paluch et al., Lancet Public Health 2022 (meta-analysis of 15 cohorts)",
    url: "https://pubmed.ncbi.nlm.nih.gov/35247352/",
  },
  "e1rm.formula": {
    id: "e1rm.formula",
    title: "Estimated 1RM",
    summary: "Epley: weight × (1 + reps/30), using sets of 10 reps or fewer.",
    grade: "C",
    source: "Standard estimator. Less accurate at higher reps.",
  },
  "progress.stall": {
    id: "progress.stall",
    title: "Stalled lift",
    summary: "No new e1RM best in 4+ weeks while still training the lift.",
    grade: "C",
    source: "App heuristic",
  },
} as const satisfies Record<string, Guideline>;

export type GuidelineId = keyof typeof GUIDELINES;

/** Numeric thresholds used by the rule engine. User-adjustable targets live in settings; these are fixed rule constants. */
export const RULES = {
  trend: { alpha: 0.1, minWeighInsIn14d: 8 },
  rate: {
    /** %BW/month bands are derived from settings targets; these are the extra margins. */
    tooFastMarginPct: 0.5, // > targetMax + 0.5 => red
    /** Near-misses within this many %/mo of the band count as on target (avoids "eat 10 fewer kcal" advice). */
    tolerancePct: 0.1,
    spike14dPctPerMonth: 3,
    losingWeeks: 3,
  },
  protein: { perMealMinG: 20 },
  volume: { lowSets: 6, veryHighSets: 25 },
  stall: { weeks: 4 },
  tdee: { windowDays: 28, minLoggedDays: 18, driftKcal: 150 },
  correlation: { minN: 10 },
  e1rm: { maxReps: 10 },
  outlier: { strongWeightMultiple: 2.5 },
} as const;
