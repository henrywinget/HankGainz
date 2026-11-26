import type { Snapshot } from "./snapshot";
import type { Dataset } from "@/lib/dataset";
import type { GuidelineId } from "@/guidelines";
import { RULES } from "@/guidelines";
import { EXERCISE_BY_ID, MUSCLE_LABEL, type Muscle } from "@/config/exercises";
import { kgToLb, fmtInt, fmtGPerLb } from "@/lib/units";
import { fmtShort, addDays, daysBetween } from "@/lib/dates";
import { PHASE_LABEL, judgesRate } from "@/config/settings";
import { allPhaseReports } from "@/metrics/phases";
import { KCAL_PER_KG } from "@/lib/units";

/** win = encouragement · info = context · warn = heads-up · harsh = reality check */
export type Tone = "win" | "info" | "warn" | "harsh";

export interface Insight {
  id: string;
  tone: Tone;
  title: string;
  body: string;
  guideline?: GuidelineId;
  /** what the claim is computed from, shown as fine print */
  basis?: string;
}

const lb = (kg: number, d = 1) => kgToLb(kg).toFixed(d);
const pct = (x: number) => `${x > 0 ? "+" : ""}${x.toFixed(2)}%`;

export function generateInsights(ds: Dataset, s: Snapshot): Insight[] {
  const out: Insight[] = [];
  const set = ds.settings;
  const phase = set.phase;

  // ── Goal phase context ───────────────────────────────────────────────
  const cur = ds.currentPhase;
  if (cur && s.phaseDay != null) {
    const startKg = ds.trend.get(addDays(cur.start, -1)) ?? ds.trend.get(cur.start);
    const delta = startKg != null && s.trendNowKg ? kgToLb(s.trendNowKg - startKg) : null;
    const since = `since ${fmtShort(cur.start)}`;
    if (cur.kind === "off_plan") {
      out.push({ id: "phase.current", tone: "warn", title: `No active goal (off plan, day ${s.phaseDay})`, body: `${delta != null ? `Trend ${delta > 0 ? "+" : ""}${delta.toFixed(1)} lb ${since}. ` : ""}Set a goal on the Goals page so the coach has something to aim at.`, basis: `goal phase since ${cur.start}` });
    } else {
      out.push({ id: "phase.current", tone: "info", title: `${PHASE_LABEL[cur.kind]} · day ${s.phaseDay}`, body: `${delta != null ? `Trend ${delta > 0 ? "+" : ""}${delta.toFixed(1)} lb ${since}.` : `Started ${fmtShort(cur.start)}.`}${cur.note ? ` "${cur.note}"` : ""}`, basis: `goal phase since ${cur.start}` });
    }
  } else if (!cur) {
    out.push({ id: "phase.current", tone: "warn", title: "No goal set for today", body: "Today isn't covered by any goal phase. Add or extend one on the Goals page." });
  }

  // ── Bodyweight rate (current phase only) ─────────────────────────────
  if (judgesRate(phase) && s.phaseRate && s.rateStatus && s.trendNowKg) {
    const r = s.phaseRate;
    const lbMo = kgToLb((r.pctPerMonth / 100) * s.trendNowKg);
    const basis = `${r.windowDays}-day trend slope within this phase, ${r.weighIns} weigh-ins · target ${set.rateMinPctPerMonth}–${set.rateMaxPctPerMonth}% BW/mo`;
    const g: GuidelineId = phase === "cut" ? "rate.cut.max" : "rate.leanGain.intermediate";
    const lbMoS = `${lbMo > 0 ? "+" : ""}${lbMo.toFixed(1)} lb/mo`;
    switch (s.rateStatus) {
      case "on_target":
        out.push({ id: "weight.rate", tone: "win", title: phase === "lean_gain" ? "Dialed in. Lean-gain zone." : phase === "cut" ? "Cutting right on pace" : "Holding steady", body: phase === "cut" ? `Losing ${pct(r.pctPerMonth)} BW/month (${lbMoS}). Fast enough to see progress, slow enough to keep your strength.` : phase === "lean_gain" ? `Trend is moving ${pct(r.pctPerMonth)} BW/month (${lbMoS}). This is the zone where muscle gain outpaces fat gain. Keep doing exactly this.` : `Trend is moving ${pct(r.pctPerMonth)} BW/month (${lbMoS}), within your maintenance band.`, guideline: g, basis });
        break;
      case "above":
      case "far_above": {
        const far = s.rateStatus === "far_above";
        const over = r.pctPerMonth - set.rateMaxPctPerMonth;
        const trim = Math.round(((over / 100) * s.trendNowKg * KCAL_PER_KG) / 30.44 / 10) * 10;
        if (phase === "cut") {
          const stalled = r.pctPerMonth >= 0;
          out.push({
            id: "weight.rate",
            tone: stalled ? "harsh" : "warn",
            title: stalled ? "Reality check: the cut has stalled" : "Cutting slower than planned",
            body: stalled
              ? `Trend is ${pct(r.pctPerMonth)}/month. Not losing at all. Pull ~${trim} kcal/day or add steps.`
              : `Losing ${pct(r.pctPerMonth)}/month (${lbMoS}) against a ${set.rateMinPctPerMonth} to ${set.rateMaxPctPerMonth}% target. Still progress, just slower. ~${trim} fewer kcal/day would put you on pace.`,
            guideline: g, basis,
          });
        } else {
          out.push({ id: "weight.rate", tone: far ? "harsh" : "warn", title: far ? "Reality check: gaining too fast" : "Running a little hot", body: `Trend is climbing ${pct(r.pctPerMonth)} BW/month (${lbMoS}). ${far ? "That's well past your range. The extra is mostly fat, not muscle. " : "Upper edge of your range. "}Trimming ~${trim} kcal/day gets you back in the zone.`, guideline: far ? "rate.surplus.small" : g, basis });
        }
        break;
      }
      case "below":
      case "far_below": {
        const harsh = s.rateStatus === "far_below";
        const under = set.rateMinPctPerMonth - r.pctPerMonth;
        const add = Math.round(((under / 100) * s.trendNowKg * KCAL_PER_KG) / 30.44 / 10) * 10;
        const body = phase === "cut"
          ? `Losing ${pct(r.pctPerMonth)}/month, faster than your target. ${harsh ? "At this pace you're risking muscle. " : ""}Add back ~${add} kcal/day and keep protein high.`
          : phase === "lean_gain"
            ? `Trend is ${r.pctPerMonth < 0 ? "dropping" : "barely moving"}: ${pct(r.pctPerMonth)} BW/month (${lbMoS}). ${harsh ? "You can't build much muscle while losing weight. " : ""}Add ~${add} kcal/day to get into the lean-gain zone.`
            : `Drifting ${pct(r.pctPerMonth)}/month. Add ~${add} kcal/day to hold steady.`;
        out.push({ id: "weight.rate", tone: harsh ? "harsh" : "warn", title: harsh ? (phase === "lean_gain" ? "Reality check: you're losing, not gaining" : "Reality check: losing too fast") : "Below your target rate", body, guideline: g, basis });
        break;
      }
    }
  } else if (judgesRate(phase) && s.phaseDay != null && s.phaseDay < 14) {
    out.push({ id: "weight.rate", tone: "info", title: `Phase is ${s.phaseDay} days old`, body: "Need 14 days inside this phase before judging its rate. Early weeks are mostly water and glycogen anyway.", basis: "trend slope within the current phase" });
  } else if (judgesRate(phase)) {
    out.push({ id: "weight.rate", tone: "info", title: "Not enough weigh-ins", body: "Need regular weigh-ins over at least two weeks to judge your rate of change.", basis: "trend slope" });
  }

  // ── Most recent completed phase (retrospective) ──────────────────────
  const reports = allPhaseReports(ds);
  const lastDone = [...reports].reverse().find((r) => !r.ongoing);
  if (lastDone && daysBetween(lastDone.to, ds.today) <= 45 && lastDone.trendStartKg != null && lastDone.trendEndKg != null) {
    const d = kgToLb(lastDone.trendEndKg - lastDone.trendStartKg);
    const weeks = Math.round(lastDone.days / 7);
    const range = `${fmtShort(lastDone.from)} to ${fmtShort(lastDone.to)}`;
    const dS = `${d > 0 ? "+" : ""}${d.toFixed(1)} lb`;
    if (lastDone.phase.kind === "off_plan") {
      const regain = lastDone.regainOfPrevious;
      out.push({
        id: "phase.previous",
        tone: d > 1 ? "harsh" : "info",
        title: `Off plan ${range}: ${dS} in ${weeks} weeks`,
        body: `${regain != null && regain > 0 ? `That undid about ${Math.round(regain * 100)}% of the cut before it. ` : ""}Averaged ${fmtInt(lastDone.avgKcal)} kcal/day. You've already turned it around; the Goals page has the full report card.`,
        basis: "phase report: trend at start vs end",
      });
    } else if (lastDone.verdict && lastDone.ratePctPerMonth != null) {
      const t: Tone = lastDone.verdict.tone === "good" ? "win" : lastDone.verdict.tone === "bad" ? "harsh" : "warn";
      out.push({ id: "phase.previous", tone: t, title: `Last ${PHASE_LABEL[lastDone.phase.kind].toLowerCase()} (${range}): ${lastDone.verdict.label.toLowerCase()}`, body: `${dS} at ${pct(lastDone.ratePctPerMonth)}/month vs a ${lastDone.phase.targets.rateMinPctPerMonth} to ${lastDone.phase.targets.rateMaxPctPerMonth}% target.`, basis: "phase report" });
    }
  }

  if (s.rate14 && s.rate14.weighIns >= RULES.trend.minWeighInsIn14d && Math.abs(s.rate14.pctPerMonth) > RULES.rate.spike14dPctPerMonth && s.trendNowKg) {
    const lb14 = kgToLb(s.rate14.kgPerWeek * 2);
    out.push({ id: "weight.spike", tone: "harsh", title: `Rapid ${lb14 > 0 ? "gain" : "drop"}: ${lb14 > 0 ? "+" : ""}${lb14.toFixed(1)} lb in 14 days`, body: `Your trend is moving at ${pct(s.rate14.pctPerMonth)} BW/month over the last two weeks. Some is water/glycogen, but if this continues it isn't lean ${lb14 > 0 ? "gain" : "loss"}.`, basis: `14-day trend slope, ${s.rate14.weighIns} weigh-ins` });
  }

  // ── Maintenance / intake ─────────────────────────────────────────────
  if (s.tdee) {
    const t = s.tdee;
    out.push({
      id: "tdee",
      tone: "info",
      title: `Your maintenance ≈ ${fmtInt(Math.round(t.kcal / 10) * 10)} kcal`,
      body: s.targetKcal ? `To hit the middle of your target rate, aim for ≈ ${fmtInt(Math.round(s.targetKcal / 10) * 10)} kcal/day. You've averaged ${fmtInt(t.avgIntake)} over the last ${t.windowDays} days.` : `Based on what you ate vs. how your trend moved.`,
      basis: `Adaptive TDEE: ${t.loggedDays}/${t.windowDays} days logged, trend Δ ${lb(t.trendDeltaKg)} lb, confidence ${t.confidence}`,
    });
  }

  if (s.bigDays.length && s.medianKcal) {
    const extra = s.bigDays.reduce((a, d) => a + (d.kcal! - s.medianKcal!), 0);
    const worst = s.bigDays.reduce((a, b) => (b.kcal! > a.kcal! ? b : a));
    out.push({
      id: "nutrition.bigDays",
      tone: s.bigDays.length >= 3 ? "harsh" : "warn",
      title: `${s.bigDays.length} blowout day${s.bigDays.length > 1 ? "s" : ""} (> 2× your median)`,
      body: `Biggest: ${fmtInt(worst.kcal)} kcal on ${fmtShort(worst.date)}. Together they added ~${fmtInt(extra)} kcal above a normal day, roughly ${kgToLb(extra / KCAL_PER_KG).toFixed(1)} lb of tissue if it weren't offset. Honest logging though, so respect for that.`,
      basis: `median ${fmtInt(s.medianKcal)} kcal over ${s.loggedDays} logged days`,
    });
  }

  if (s.fastDays) {
    out.push({ id: "nutrition.fasts", tone: "info", title: `${s.fastDays} fast day${s.fastDays > 1 ? "s" : ""} in this window`, body: "Counted as real 0-kcal days in averages and maintenance math.", basis: "logged days under 100 kcal" });
  }

  // ── Protein ──────────────────────────────────────────────────────────
  if (s.proteinGPerKg != null && s.avgProteinG != null) {
    const ok = s.proteinGPerKg >= set.proteinMinGPerKg;
    const veryLow = s.proteinGPerKg < 1.4;
    const nonFast = s.days.filter((d) => d.kcal != null && !d.isFast).length || 1;
    out.push({
      id: "protein.status",
      tone: ok ? "win" : veryLow ? "harsh" : "warn",
      title: ok ? `Protein locked in: ${fmtGPerLb(s.proteinGPerKg)} g/lb` : `Protein short: ${fmtGPerLb(s.proteinGPerKg)} g/lb`,
      body: ok
        ? `Averaging ${fmtInt(s.avgProteinG)} g/day. ${s.proteinDaysOnTarget} of ${nonFast} eating days hit your ${fmtGPerLb(set.proteinMinGPerKg)} g/lb floor.`
        : `Averaging ${fmtInt(s.avgProteinG)} g/day, below your ${fmtGPerLb(set.proteinMinGPerKg)} g/lb floor (${s.trendNowKg ? fmtInt(set.proteinMinGPerKg * s.trendNowKg) : "?"} g). ${veryLow ? "That's under the minimum research supports for building muscle." : "Close the gap with one more protein-heavy meal."}`,
      guideline: "protein.daily.gain",
      basis: `${s.loggedDays} logged days, protein ÷ trend bodyweight (lb)`,
    });
  }
  const weakMeal = s.mealProtein.filter((m) => m.days >= 5 && m.avgG < RULES.protein.perMealMinG && m.meal !== "Snacks");
  for (const m of weakMeal) {
    out.push({ id: `protein.meal.${m.meal}`, tone: "warn", title: `${m.meal} protein is light: ${Math.round(m.avgG)} g`, body: `Research suggests 20–40 g per meal. A protein-forward ${m.meal.toLowerCase()} spreads intake more evenly through the day.`, guideline: "protein.perMeal", basis: `avg over ${m.days} ${m.meal.toLowerCase()}s` });
  }

  // ── Training ─────────────────────────────────────────────────────────
  if (s.prs.length) {
    const top = s.prs.slice(0, 3).map((p) => `${EXERCISE_BY_ID.get(p.liftId)?.name} ${lb(p.session.e1rmKg, 0)}`).join(" · ");
    out.push({ id: "lift.prs", tone: "win", title: `${s.prs.length} new PR${s.prs.length > 1 ? "s" : ""}. Keep stacking.`, body: `Latest e1RM bests: ${top} lb.`, guideline: "e1rm.formula", basis: "best Epley e1RM per session, key lifts" });
  }
  for (const st of s.stalls) {
    const name = EXERCISE_BY_ID.get(st.liftId)?.name ?? st.liftId;
    const losing = s.rate28 && s.rate28.pctPerMonth < 0;
    out.push({
      id: `lift.stall.${st.liftId}`,
      tone: phase === "cut" ? "info" : st.weeksSincePr >= 8 ? "harsh" : "warn",
      title: `${name} stalled ${st.weeksSincePr} weeks`,
      body: `No e1RM best since ${fmtShort(st.lastPrDate)} (${st.sessionsSince} sessions).${phase === "cut" ? " You're cutting, so holding strength is the goal. Only worry if it keeps sliding." : losing ? " Your bodyweight trend is falling, which often explains a strength plateau." : " Try changing the rep range, adding a set, or a short deload."}`,
      guideline: "progress.stall",
      basis: "Epley e1RM, sessions with ≤ 10-rep working sets",
    });
  }
  if (s.muscleSetsPerWeek.size) {
    // Only muscles Hank chose to prioritize are judged; the rest are intentionally light.
    const tracked: Muscle[] = set.focusMuscles;
    const low = tracked.filter((m) => (s.muscleSetsPerWeek.get(m) ?? 0) < set.setsMinPerMuscle);
    const veryLow = low.filter((m) => (s.muscleSetsPerWeek.get(m) ?? 0) < RULES.volume.lowSets);
    const high = tracked.filter((m) => (s.muscleSetsPerWeek.get(m) ?? 0) > RULES.volume.veryHighSets);
    if (veryLow.length) out.push({ id: "volume.low", tone: "harsh", title: `Under-trained: ${veryLow.map((m) => MUSCLE_LABEL[m]).join(", ")}`, body: `Fewer than ${RULES.volume.lowSets} hard sets/week. That's maintenance volume at best for these muscles.`, guideline: "volume.target.weekly", basis: "avg weekly fractional sets (direct 1, indirect 0.5)" });
    else if (low.length) out.push({ id: "volume.low", tone: "warn", title: `Below ${set.setsMinPerMuscle} sets/week: ${low.map((m) => MUSCLE_LABEL[m]).join(", ")}`, body: "Adding 2–4 sets a week to these is the cheapest growth available.", guideline: "volume.target.weekly", basis: "avg weekly fractional sets" });
    if (high.length) out.push({ id: "volume.high", tone: "warn", title: `Very high volume: ${high.map((m) => MUSCLE_LABEL[m]).join(", ")}`, body: `Over ${RULES.volume.veryHighSets} sets/week. Returns diminish here, so make sure recovery keeps up.`, guideline: "volume.doseResponse", basis: "avg weekly fractional sets" });
    if (tracked.length && !veryLow.length && !low.length && !high.length) out.push({ id: "volume.ok", tone: "win", title: "Focus muscles are covered", body: `Every focus muscle gets ${set.setsMinPerMuscle}+ hard sets a week, which is good work for a compound-first plan.`, guideline: "volume.target.weekly" });
  }
  if (s.days.length >= 14) {
    const { sessionsMinPerWeek: lo, sessionsMaxPerWeek: hi } = set;
    const spw = s.sessionsPerWeek;
    const basis = `${s.days.length}-day window · plan ${lo}–${hi}/week`;
    if (spw > hi + 0.5) out.push({ id: "consistency", tone: "warn", title: `${spw.toFixed(1)} sessions/week, above your ${hi}/week cap`, body: "More than you planned. If gym time is creeping up, cut accessories before compounds.", basis });
    else if (spw >= lo) out.push({ id: "consistency", tone: "win", title: `${spw.toFixed(1)} sessions/week, right on plan`, body: `${s.sessions} sessions in this window, inside your ${lo}–${hi} plan. Consistency is the whole game.`, basis });
    else if (spw < lo - 1) out.push({ id: "consistency", tone: "harsh", title: `Only ${spw.toFixed(1)} sessions/week`, body: "You can't out-eat missed workouts. In a surplus without training, the gain is fat.", basis });
    else out.push({ id: "consistency", tone: "warn", title: `${spw.toFixed(1)} sessions/week, a bit under plan`, body: `Your plan is ${lo}–${hi}. One more session a week gets you there.`, basis });
  }

  // ── Steps ────────────────────────────────────────────────────────────
  if (s.avgSteps != null && s.stepDays >= 5) {
    const ok = s.avgSteps >= set.stepGoal;
    out.push({
      id: "steps",
      tone: ok ? "win" : s.avgSteps < set.stepGoal * 0.6 ? "harsh" : "warn",
      title: ok ? `${fmtInt(s.avgSteps)} steps/day. Moving well.` : `${fmtInt(s.avgSteps)} steps/day. Below your ${fmtInt(set.stepGoal)} goal.`,
      body: `${s.stepDaysAtGoal} of ${s.stepDays} days hit the goal.${ok ? "" : " Daily movement is the easiest lever on maintenance calories and long-term health."}`,
      guideline: "steps.daily",
      basis: "iPhone step count, today excluded",
    });
  }

  if (ds.flaggedSets) out.push({ id: "data.flagged", tone: "warn", title: `${ds.flaggedSets} set(s) need review`, body: "Possible typos in your Strong log. Fix them on the Import page so they don't skew e1RM and volume." });

  const order: Record<Tone, number> = { harsh: 0, warn: 1, win: 2, info: 3 };
  // Current-phase context always leads.
  const pin = (i: Insight) => (i.id === "phase.current" ? -1 : order[i.tone]);
  return out.sort((a, b) => pin(a) - pin(b));
}
