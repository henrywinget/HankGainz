import { Suspense } from "react";
import type { Metadata } from "next";
import { loadDataset } from "@/lib/dataset";
import { parseRange, rangeLabel } from "@/lib/range";
import { buildSnapshot } from "@/insights/snapshot";
import { generateInsights } from "@/insights/rules";
import { Card, CardTitle, InsightFeed, PageHeader, PageSkeleton, RangePicker, Stat } from "@/components/ui";
import { E1rmChart, MuscleVolumeChart } from "@/components/charts";
import { TrainingHeatmap } from "@/components/training-heatmap";
import { EXERCISE_BY_ID, KEY_LIFTS, MUSCLE_LABEL } from "@/config/exercises";
import { kgToLb, fmtInt } from "@/lib/units";
import { fmtShort } from "@/lib/dates";

export const metadata: Metadata = { title: "Training" };

export default function TrainingPage(props: PageProps<"/training">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Training searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Training({ searchParams }: { searchParams: PageProps<"/training">["searchParams"] }) {
  const range = parseRange((await searchParams).range, 90);
  const ds = await loadDataset();
  const s = buildSnapshot(ds, range);
  const set = ds.settings;
  const insights = generateInsights(ds, s).filter((i) => i.id.startsWith("lift") || i.id.startsWith("volume") || i.id === "consistency" || i.id === "data.flagged");

  const lifts = KEY_LIFTS.map((l) => ({
    id: l.id,
    name: l.name,
    points: (ds.liftSessions.get(l.id) ?? [])
      .filter((x) => x.date >= s.from)
      .map((x) => ({ date: x.date, e1rm: Math.round(kgToLb(x.e1rmKg)), pr: x.isPr, set: `${Math.round(kgToLb(x.bestSet.weightKg))}×${x.bestSet.reps}` })),
  }));

  const bests = KEY_LIFTS.map((l) => {
    const xs = ds.liftSessions.get(l.id) ?? [];
    const best = xs.reduce<(typeof xs)[number] | null>((a, b) => (!a || b.e1rmKg > a.e1rmKg ? b : a), null);
    const inRange = xs.filter((x) => x.date >= s.from);
    const first = inRange[0], last = inRange.at(-1);
    return { lift: l, best, change: first && last && first !== last ? kgToLb(last.e1rmKg - first.e1rmKg) : null };
  });

  const muscles = [...s.muscleSetsPerWeek.entries()]
    .filter(([m]) => !["abs", "abductors", "adductors"].includes(m) || (s.muscleSetsPerWeek.get(m) ?? 0) > 1)
    .map(([m, v]) => ({ muscle: MUSCLE_LABEL[m], sets: Math.round(v * 10) / 10, focus: set.focusMuscles.includes(m) }))
    .sort((a, b) => b.sets - a.sets);

  const avgDuration = (() => {
    const byWorkout = new Map<string, number>();
    for (const x of ds.sets) if (x.localDate >= s.from && x.workoutDurationS) byWorkout.set(x.workoutStart, x.workoutDurationS);
    const v = [...byWorkout.values()];
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length / 60 : null;
  })();

  return (
    <>
      <PageHeader title="Training" kicker="Progressive overload or bust">
        <RangePicker range={range} path="/training" />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Sessions" value={s.sessions} accent="pink" sub={`${s.sessionsPerWeek.toFixed(1)} / week · ${rangeLabel(range)}`} />
        <Stat label="Working sets" value={s.workingSets} accent="purple" sub="warm-ups excluded" />
        <Stat label="Volume moved" value={Math.round(kgToLb(s.tonnageKg))} unit="lb" accent="cyan" sub="Σ weight × reps" />
        <Stat label="PRs" value={s.prs.length} accent="mint" sub={avgDuration ? `avg session ${Math.round(avgDuration)} min` : undefined} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card accent="pink" className="lg:col-span-8">
          <CardTitle sub="Tap a lift to toggle it">Strength curve (e1RM)</CardTitle>
          <E1rmChart lifts={lifts} />
        </Card>
        <Card accent="sun" className="lg:col-span-4">
          <CardTitle sub="All-time best e1RM · change within range">Key lifts</CardTitle>
          <div className="space-y-2.5">
            {bests.map(({ lift, best, change }) => {
              const stalled = s.stalls.find((x) => x.liftId === lift.id);
              return (
                <div key={lift.id} className="flex items-center gap-3 rounded-xl border border-line bg-white/3 px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{lift.name}</div>
                    <div className="text-[11px] text-faint">{best ? `${Math.round(kgToLb(best.bestSet.weightKg))} × ${best.bestSet.reps} on ${fmtShort(best.date)}` : "no data"}</div>
                  </div>
                  <div className="ml-auto text-right">
                    <div className="font-display text-lg font-bold text-sun tabular-nums">{best ? Math.round(kgToLb(best.e1rmKg)) : "—"}</div>
                    <div className={`text-[11px] tabular-nums ${stalled ? "text-orange" : change != null && change > 0 ? "text-mint" : "text-faint"}`}>
                      {stalled ? `stalled ${stalled.weeksSincePr}w` : change != null ? `${change > 0 ? "+" : ""}${Math.round(change)} lb` : "—"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card accent="mint" className="lg:col-span-6">
          <CardTitle sub={`Avg hard sets/week, full weeks only · mint band = ${set.setsMinPerMuscle}–${set.setsMaxPerMuscle}`}>Volume per muscle</CardTitle>
          {muscles.length ? <MuscleVolumeChart data={muscles} min={set.setsMinPerMuscle} max={set.setsMaxPerMuscle} /> : <p className="text-sm text-muted">Need at least one full week in range.</p>}
          <p className="mt-2 text-[11px] text-faint">Direct sets count 1, indirect (secondary muscle) 0.5. Focus muscles: red &lt; 6 · orange &lt; {set.setsMinPerMuscle} · gold &gt; 25. Grey = not a focus muscle (intentionally light, never flagged). Change focus in Settings.</p>
        </Card>
        <div className="grid gap-4 lg:col-span-6">
          <Card accent="purple">
            <CardTitle sub="Each square is a day · brighter = more working sets">Training calendar</CardTitle>
            <TrainingHeatmap days={s.days.map((d) => ({ date: d.date, sets: d.workingSets, steps: d.steps }))} />
          </Card>
          <Card accent="mint">
            <CardTitle>Recent PRs</CardTitle>
            <div className="grid gap-2 sm:grid-cols-2">
              {s.prs.slice(0, 8).map((p) => (
                <div key={`${p.liftId}-${p.session.date}`} className="flex items-center justify-between rounded-xl border border-mint/20 bg-mint/5 px-3 py-2 text-sm">
                  <span>{EXERCISE_BY_ID.get(p.liftId)?.name}</span>
                  <span className="font-display text-mint tabular-nums">{Math.round(kgToLb(p.session.e1rmKg))}<span className="ml-1 font-sans text-[11px] text-faint">{fmtShort(p.session.date)}</span></span>
                </div>
              ))}
              {!s.prs.length && <p className="text-sm text-faint">No PRs in this window. Time to push.</p>}
            </div>
          </Card>
        </div>

        <Card accent="pink" className="lg:col-span-12">
          <CardTitle>Coach on your training</CardTitle>
          <div className="grid gap-3 md:grid-cols-2"><InsightFeed insights={insights} /></div>
          <p className="mt-3 text-[11px] text-faint">{fmtInt(ds.sets.length)} sets imported from Strong.</p>
        </Card>
      </div>
    </>
  );
}
