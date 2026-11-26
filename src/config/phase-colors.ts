import type { Phase } from "./settings";

/** Shared by server and client components (constants can't be imported from a "use client" module on the server). */
export const PHASE_COLOR: Record<Phase, string> = { lean_gain: "#01ffc3", maintain: "#b967ff", cut: "#05d9e8", off_plan: "#ff9e3d" };
export const PHASE_SHORT: Record<Phase, string> = { lean_gain: "LEAN GAIN", maintain: "MAINTAIN", cut: "CUT", off_plan: "OFF PLAN" };
