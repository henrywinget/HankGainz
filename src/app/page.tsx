import { Suspense } from "react";
import Link from "next/link";
import { loadDataset } from "@/lib/dataset";
import { parseRange, rangeLabel } from "@/lib/range";
import { buildSnapshot } from "@/insights/snapshot";
import { generateInsights } from "@/insights/rules";
import { Card, CardTitle, InsightFeed, PageHeader, PageSkeleton, RangePicker, Stat, TargetBar } from "@/components/ui";
import { RateGauge } from "@/components/rate-gauge";
import { DigestCard } from "@/components/digest-card";
import { CaloriesChart, StepsChart, WeightChart } from "@/components/charts";
import { caloriesSeries, stepsSeries, weightSeries } from "@/lib/series";
import { kgToLb, fmtInt, fmtGPerLb, gPerKgToGPerLb } from "@/lib/units";
import { PHASE_LABEL, judgesRate } from "@/config/settings";

export default function OverviewPage(props: PageProps<"/">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Overview searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Overview({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  const range = parseRange((await searchParams).range);
  const ds = await loadDataset();

  if (!ds.days.length || ds.importsCount === 0) {
    return (
      <>
        <PageHeader title="Overview" kicker="Welcome, Hank" />
        <Card className="max-w-xl">
          <p className="text-muted">No data yet. <Link href="/import" className="text-pink underline">Import your exports</Link> to light this place up.</p>
        </Card>
      </>
    );
  }

  const s = buildSnapshot(ds, range);
  const insights = generateInsights(ds, s);
  const set = ds.settings;
  const trendDeltaLb = s.trendNowKg && s.trendStartKg ? kgToLb(s.trendNowKg - s.trendStartKg) : null;
  const kgNow = s.trendNowKg ?? 75;
  const weeks = Math.max(1, s.days.length / 7);
  const focusHit = set.focusMuscles.filter((m) => (s.muscleSetsPerWeek.get(m) ?? 0) >= set.setsMinPerMuscle).length;

  return (
    <>
      <PageHeader title="Overview" kicker={greeting(insights.filter((i) => i.tone === "harsh").length)}>
        <RangePicker range={range} path="/" />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat
          label="Weight trend"
          value={s.trendNowKg ? kgToLb(s.trendNowKg) : null}
          digits={1}
          unit="lb"
          accent="pink"
          delta={trendDeltaLb != null ? `${trendDeltaLb > 0 ? "+" : ""}${trendDeltaLb.toFixed(1)}` : undefined}
          deltaGood={null}
          sub={`${PHASE_LABEL[set.phase]}${s.phaseDay != null ? ` · day ${s.phaseDay}` : ""} · ${rangeLabel(range)}`}
        />
        <Stat
          label="Avg calories"
          value={s.avgKcal}
          unit="kcal"
          accent="sun"
          sub={s.targetKcal ? `target ≈ ${fmtInt(Math.round(s.targetKcal / 10) * 10)} · ${s.loggedDays} days logged` : `${s.loggedDays} days logged`}
        />
        <Stat
          label="Protein"
          value={s.proteinGPerKg == null ? null : gPerKgToGPerLb(s.proteinGPerKg)}
          digits={2}
          unit="g/lb"
          accent="mint"
          sub={`${fmtInt(s.avgProteinG)} g/day avg · floor ${fmtGPerLb(set.proteinMinGPerKg)} g/lb`}
        />
        <Stat label="Avg steps" value={s.avgSteps} accent="cyan" sub={`${s.stepDaysAtGoal}/${s.stepDays} days ≥ ${fmtInt(set.stepGoal)}`} />
      </div>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-12">
       <div className="grid gap-4 lg:col-span-8 md:grid-cols-2">
        <Card accent="mint">
          <CardTitle sub={s.phaseRate ? `Trend slope over ${s.phaseRate.windowDays} days of this ${PHASE_LABEL[set.phase].toLowerCase()} phase` : "Trend slope within the current goal phase"}>Rate of change</CardTitle>
          <RateGauge pctPerMonth={s.phaseRate?.pctPerMonth ?? null} settings={set} label={s.rateVerdict?.label ?? (judgesRate(set.phase) ? (s.phaseDay != null && s.phaseDay < 14 ? `Phase day ${s.phaseDay}, need 14` : "Need more weigh-ins") : "No rate goal")} tone={s.rateVerdict?.tone ?? null} />
          {s.rate14 && (
            <p className="mt-3 text-center text-xs text-faint">
              14-day: <span className="text-muted">{s.rate14.pctPerMonth > 0 ? "+" : ""}{s.rate14.pctPerMonth.toFixed(2)}%/mo</span> ({kgToLb(s.rate14.kgPerWeek) > 0 ? "+" : ""}{kgToLb(s.rate14.kgPerWeek).toFixed(2)} lb/wk)
            </p>
          )}
        </Card>

        <Card accent="cyan">
          <CardTitle sub={rangeLabel(range)}>Targets</CardTitle>
          <div className="space-y-4">
            <TargetBar label="Protein (g/lb bodyweight)" value={s.proteinGPerKg == null ? null : gPerKgToGPerLb(s.proteinGPerKg)} min={gPerKgToGPerLb(set.proteinMinGPerKg)} max={gPerKgToGPerLb(set.proteinMaxGPerKg)} scaleMax={Math.max(1.4, gPerKgToGPerLb(s.proteinGPerKg ?? 0) + 0.15)} format={(n) => n.toFixed(2)} />
            {s.targetKcal && <TargetBar label="Calories vs target" value={s.avgKcal} min={s.targetKcal * 0.95} max={s.targetKcal * 1.05} scaleMax={s.targetKcal * 1.4} format={(n) => fmtInt(n)} accent="orange" />}
            <TargetBar label="Steps / day" value={s.avgSteps} min={set.stepGoal} scaleMax={Math.max(set.stepGoal * 1.6, s.avgSteps ?? 0)} format={(n) => `${(n / 1000).toFixed(1)}k`} accent="cyan" />
            <TargetBar label="Sessions / week" value={s.sessionsPerWeek} min={set.sessionsMinPerWeek} max={set.sessionsMaxPerWeek} scaleMax={Math.max(set.sessionsMaxPerWeek + 2, s.sessionsPerWeek)} format={(n) => n.toFixed(1)} accent="purple" />
            {s.muscleSetsPerWeek.size > 0 && set.focusMuscles.length > 0 && <TargetBar label={`Focus muscles at ${set.setsMinPerMuscle}+ sets/wk`} value={focusHit} min={set.focusMuscles.length} scaleMax={set.focusMuscles.length} format={(n) => `${Math.round(n)}`} accent="purple" />}
          </div>
          <p className="mt-4 text-[11px] text-faint">{s.sessions} sessions · {fmtInt(s.workingSets)} working sets · {fmtInt(kgToLb(s.tonnageKg) / weeks)} lb/wk moved · {s.prs.length} PRs</p>
        </Card>

        <Card accent="pink" className="md:col-span-2">
          <CardTitle sub="Dots = weigh-ins · line = smoothed trend" right={<Link href={`/body?range=${range}`} className="text-xs text-cyan hover:underline">Body →</Link>}>Bodyweight</CardTitle>
          <WeightChart data={weightSeries(s.days)} height={280} phases={ds.phases.map((p) => ({ start: p.start, end: p.end, kind: p.kind }))} />
        </Card>
        <Card accent="sun">
          <CardTitle sub="Cyan = fast day · orange/red = over target" right={<Link href={`/nutrition?range=${range}`} className="text-xs text-cyan hover:underline">Nutrition →</Link>}>Calories</CardTitle>
          <CaloriesChart data={caloriesSeries(s.days)} target={s.targetKcal} height={220} />
        </Card>
        <Card accent="cyan">
          <CardTitle sub="Today excluded (still counting)">Steps</CardTitle>
          <StepsChart data={stepsSeries(s.days)} goal={set.stepGoal} height={220} />
        </Card>
       </div>

        <div className="grid gap-4 lg:col-span-4">
          <DigestCard />
          <Card accent="pink">
            <CardTitle sub="Wins, warnings and reality checks">Coach</CardTitle>
            <InsightFeed insights={insights} limit={7} />
          </Card>
        </div>
      </div>

      <p className="mt-6 text-center text-[11px] text-faint">Per-bodyweight targets use your trend weight ({kgToLb(kgNow).toFixed(1)} lb). Training & nutrition guidance, not medical advice.</p>
    </>
  );
}

function greeting(harsh: number) {
  if (harsh >= 3) return "Hank, we need to talk";
  if (harsh > 0) return "Mostly solid, Hank";
  return "Looking sharp, Hank";
}
