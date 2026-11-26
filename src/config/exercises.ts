/**
 * Exercise catalog: maps raw Strong names → canonical exercise + muscles.
 * Add new Strong exercise names to `aliases` (matching is case/space/apostrophe-insensitive).
 */
export type Muscle =
  | "chest" | "front_delts" | "side_delts" | "rear_delts" | "triceps" | "biceps" | "forearms"
  | "lats" | "upper_back" | "traps" | "lower_back" | "quads" | "hamstrings" | "glutes"
  | "adductors" | "abductors" | "calves" | "abs";

export type Pattern = "squat" | "hinge" | "h_push" | "v_push" | "h_pull" | "v_pull" | "isolation" | "cardio" | "carry";
export type LoadType = "barbell" | "dumbbell" | "machine" | "cable" | "bodyweight" | "smith" | "cardio";

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  primary: Muscle[];
  secondary: Muscle[];
  pattern: Pattern;
  load: LoadType;
  keyLift?: boolean;
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Chest", front_delts: "Front delts", side_delts: "Side delts", rear_delts: "Rear delts",
  triceps: "Triceps", biceps: "Biceps", forearms: "Forearms", lats: "Lats", upper_back: "Upper back",
  traps: "Traps", lower_back: "Lower back", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes",
  adductors: "Adductors", abductors: "Abductors", calves: "Calves", abs: "Abs",
};

const E = (e: Exercise) => e;

export const EXERCISES: Exercise[] = [
  // Key lifts
  E({ id: "squat", name: "Squat", aliases: ["Squat (Barbell)"], primary: ["quads", "glutes"], secondary: ["adductors", "lower_back"], pattern: "squat", load: "barbell", keyLift: true }),
  E({ id: "bench", name: "Bench Press", aliases: ["Bench Press (Barbell)"], primary: ["chest"], secondary: ["front_delts", "triceps"], pattern: "h_push", load: "barbell", keyLift: true }),
  E({ id: "deadlift", name: "Deadlift", aliases: ["Deadlift (Barbell)"], primary: ["hamstrings", "glutes", "lower_back"], secondary: ["traps", "forearms", "quads"], pattern: "hinge", load: "barbell", keyLift: true }),
  E({ id: "ohp", name: "Overhead Press", aliases: ["Overhead Press (Barbell)"], primary: ["front_delts"], secondary: ["side_delts", "triceps"], pattern: "v_push", load: "barbell", keyLift: true }),
  E({ id: "row", name: "Bent Over Row", aliases: ["Bent Over Row (Barbell)"], primary: ["upper_back", "lats"], secondary: ["biceps", "rear_delts"], pattern: "h_pull", load: "barbell", keyLift: true }),
  // Hank swapped barbell rows for T-bar rows in late Oct 2026; both stay tracked so history is kept.
  E({ id: "tbar_row", name: "T Bar Row", aliases: ["T Bar Row"], primary: ["upper_back", "lats"], secondary: ["biceps", "rear_delts"], pattern: "h_pull", load: "barbell", keyLift: true }),
  E({ id: "pullup", name: "Pull Up", aliases: ["Pull Up"], primary: ["lats"], secondary: ["biceps", "upper_back"], pattern: "v_pull", load: "bodyweight", keyLift: true }),

  // Chest / push
  E({ id: "incline_bench", name: "Incline Bench Press", aliases: ["Incline Bench Press (Barbell)"], primary: ["chest"], secondary: ["front_delts", "triceps"], pattern: "h_push", load: "barbell" }),
  E({ id: "incline_bench_smith", name: "Incline Bench (Smith)", aliases: ["Incline Bench Press (Smith Machine)"], primary: ["chest"], secondary: ["front_delts", "triceps"], pattern: "h_push", load: "smith" }),
  E({ id: "dip", name: "Chest Dip", aliases: ["Chest Dip"], primary: ["chest", "triceps"], secondary: ["front_delts"], pattern: "v_push", load: "bodyweight" }),
  E({ id: "dip_assisted", name: "Chest Dip (Assisted)", aliases: ["Chest Dip (Assisted)"], primary: ["chest", "triceps"], secondary: ["front_delts"], pattern: "v_push", load: "machine" }),
  E({ id: "fly_db", name: "Chest Fly (Dumbbell)", aliases: ["Chest Fly (Dumbbell)"], primary: ["chest"], secondary: [], pattern: "isolation", load: "dumbbell" }),
  E({ id: "fly", name: "Chest Fly", aliases: ["Chest Fly"], primary: ["chest"], secondary: [], pattern: "isolation", load: "cable" }),

  // Shoulders
  E({ id: "lateral_cable", name: "Lateral Raise (Cable)", aliases: ["Lateral Raise (Cable)"], primary: ["side_delts"], secondary: [], pattern: "isolation", load: "cable" }),
  E({ id: "lateral_machine", name: "Lateral Raise (Machine)", aliases: ["Lateral Raise (Machine)"], primary: ["side_delts"], secondary: [], pattern: "isolation", load: "machine" }),
  E({ id: "shrug_db", name: "Shrug (Dumbbell)", aliases: ["Shrug (Dumbbell)"], primary: ["traps"], secondary: [], pattern: "isolation", load: "dumbbell" }),

  // Arms
  E({ id: "tri_ext_db", name: "Triceps Extension (DB)", aliases: ["Triceps Extension (Dumbbell)"], primary: ["triceps"], secondary: [], pattern: "isolation", load: "dumbbell" }),
  E({ id: "tri_ext_machine", name: "Triceps Extension (Machine)", aliases: ["Triceps Extension (Machine)"], primary: ["triceps"], secondary: [], pattern: "isolation", load: "machine" }),
  E({ id: "pushdown", name: "Triceps Pushdown", aliases: ["Triceps Pushdown (Cable - Straight Bar)"], primary: ["triceps"], secondary: [], pattern: "isolation", load: "cable" }),
  E({ id: "curl_bb", name: "Bicep Curl (Barbell)", aliases: ["Bicep Curl (Barbell)"], primary: ["biceps"], secondary: ["forearms"], pattern: "isolation", load: "barbell" }),
  E({ id: "curl_db", name: "Bicep Curl (Dumbbell)", aliases: ["Bicep Curl (Dumbbell)"], primary: ["biceps"], secondary: ["forearms"], pattern: "isolation", load: "dumbbell" }),
  E({ id: "curl_machine", name: "Bicep Curl (Machine)", aliases: ["Bicep Curl (Machine)"], primary: ["biceps"], secondary: [], pattern: "isolation", load: "machine" }),
  E({ id: "preacher_db", name: "Preacher Curl (DB)", aliases: ["Preacher Curl (Dumbbell)"], primary: ["biceps"], secondary: [], pattern: "isolation", load: "dumbbell" }),
  E({ id: "preacher_bb", name: "Preacher Curl (Barbell)", aliases: ["Preacher Curl (Barbell)"], primary: ["biceps"], secondary: [], pattern: "isolation", load: "barbell" }),
  E({ id: "hammer", name: "Hammer Curl", aliases: ["Hammer Curl (Dumbbell)"], primary: ["biceps", "forearms"], secondary: [], pattern: "isolation", load: "dumbbell" }),
  E({ id: "reverse_curl", name: "Reverse Curl", aliases: ["Reverse Curl (Barbell)"], primary: ["forearms"], secondary: ["biceps"], pattern: "isolation", load: "barbell" }),
  E({ id: "wrist_curl", name: "Wrist Curl", aliases: ["Wrist Curl"], primary: ["forearms"], secondary: [], pattern: "isolation", load: "barbell" }),

  // Back
  E({ id: "lat_pulldown", name: "Lat Pulldown", aliases: ["Lat Pulldown (Machine)"], primary: ["lats"], secondary: ["biceps"], pattern: "v_pull", load: "machine" }),
  E({ id: "seated_row", name: "Seated Row (Machine)", aliases: ["Seated Row (Machine)"], primary: ["upper_back", "lats"], secondary: ["biceps", "rear_delts"], pattern: "h_pull", load: "machine" }),
  E({ id: "wide_row_cable", name: "Seated Wide-Grip Row", aliases: ["Seated Wide-Grip Row (Cable)"], primary: ["upper_back"], secondary: ["rear_delts", "biceps"], pattern: "h_pull", load: "cable" }),

  E({ id: "back_ext", name: "Back Extension", aliases: ["Back Extension (Machine)"], primary: ["lower_back"], secondary: ["glutes", "hamstrings"], pattern: "hinge", load: "machine" }),

  // Legs
  E({ id: "squat_smith", name: "Squat (Smith)", aliases: ["Squat (Smith Machine)"], primary: ["quads", "glutes"], secondary: ["adductors"], pattern: "squat", load: "smith" }),
  E({ id: "leg_press", name: "Seated Leg Press", aliases: ["Seated Leg Press (Machine)"], primary: ["quads", "glutes"], secondary: [], pattern: "squat", load: "machine" }),
  E({ id: "leg_ext", name: "Leg Extension", aliases: ["Leg Extension (Machine)"], primary: ["quads"], secondary: [], pattern: "isolation", load: "machine" }),
  E({ id: "leg_curl", name: "Lying Leg Curl", aliases: ["Lying Leg Curl (Machine)"], primary: ["hamstrings"], secondary: [], pattern: "isolation", load: "machine" }),
  E({ id: "rdl", name: "Romanian Deadlift", aliases: ["Romanian Deadlift (Barbell)"], primary: ["hamstrings", "glutes"], secondary: ["lower_back"], pattern: "hinge", load: "barbell" }),
  E({ id: "deadlift_smith", name: "Deadlift (Smith)", aliases: ["Deadlift (Smith Machine)"], primary: ["hamstrings", "glutes"], secondary: ["lower_back", "quads"], pattern: "hinge", load: "smith" }),
  E({ id: "hip_thrust", name: "Hip Thrust", aliases: ["Hip Thrust (Barbell)"], primary: ["glutes"], secondary: ["hamstrings"], pattern: "hinge", load: "barbell" }),
  E({ id: "step_up", name: "Step-up", aliases: ["Step-up"], primary: ["quads", "glutes"], secondary: [], pattern: "squat", load: "dumbbell" }),
  E({ id: "adductor", name: "Inner Thigh", aliases: ["Inner thigh machine"], primary: ["adductors"], secondary: [], pattern: "isolation", load: "machine" }),
  E({ id: "abductor", name: "Outer Thigh / Abductor", aliases: ["Outer Thigh (Machine)", "Hip Abductor (Machine)"], primary: ["abductors"], secondary: ["glutes"], pattern: "isolation", load: "machine" }),
  E({ id: "calf_seated", name: "Seated Calf Raise", aliases: ["Seated Calf Raise (Plate Loaded)"], primary: ["calves"], secondary: [], pattern: "isolation", load: "machine" }),
  E({ id: "calf_standing", name: "Standing Calf Raise", aliases: ["Standing Calf Raise (Machine)"], primary: ["calves"], secondary: [], pattern: "isolation", load: "machine" }),

  // Core / carries
  E({ id: "crunch_machine", name: "Crunch (Machine)", aliases: ["Crunch (Machine)"], primary: ["abs"], secondary: [], pattern: "isolation", load: "machine" }),
  E({ id: "farmers_carry", name: "Farmer's Carry", aliases: ["Farmer's Carry"], primary: ["forearms", "traps"], secondary: ["abs"], pattern: "carry", load: "dumbbell" }),

  // Cardio
  E({ id: "stairmaster", name: "Stair Master", aliases: ["Stair master"], primary: [], secondary: [], pattern: "cardio", load: "cardio" }),
  E({ id: "cycling", name: "Cycling", aliases: ["Cycling"], primary: [], secondary: [], pattern: "cardio", load: "cardio" }),
  E({ id: "rowing", name: "Rowing (Machine)", aliases: ["Rowing (Machine)"], primary: [], secondary: [], pattern: "cardio", load: "cardio" }),
  E({ id: "swimming", name: "Swimming", aliases: ["Swimming"], primary: [], secondary: [], pattern: "cardio", load: "cardio" }),
];

export function normalizeName(raw: string): string {
  return raw.replace(/[‘’ʼ]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
}

const byAlias = new Map<string, Exercise>();
for (const e of EXERCISES) for (const a of e.aliases) byAlias.set(normalizeName(a), e);
export const EXERCISE_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/** Returns the catalog id, or "unmapped:<normalized name>" so unknown exercises still import. */
export function exerciseIdFor(raw: string): string {
  return byAlias.get(normalizeName(raw))?.id ?? `unmapped:${normalizeName(raw)}`;
}

export const KEY_LIFTS = EXERCISES.filter((e) => e.keyLift);
