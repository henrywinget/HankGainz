import { Suspense } from "react";
import type { Metadata } from "next";
import { loadDataset } from "@/lib/dataset";
import { parseRange, rangeLabel } from "@/lib/range";
import { buildSnapshot } from "@/insights/snapshot";
import { generateInsights } from "@/insights/rules";
import { Card, CardTitle, InsightFeed, PageHeader, PageSkeleton, RangePicker, Stat } from "@/components/ui";
import { RateGauge } from "@/components/rate-gauge";
import { WeightChart } from "@/components/charts";
import { weightSeries } from "@/lib/series";
import { kgToLb, fmtInt } from "@/lib/units";
import { GUIDELINES } from "@/guidelines";
import { PHASE_LABEL, judgesRate } from "@/config/settings";

export const metadata: Metadata = { title: "Body" };

export default function BodyPage(props: PageProps<"/body">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Body searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/body">["searchParams"] }) {
  const range = parseRange((await searchParams).range, 90);
  const ds = await loadDataset();
  const s = buildSnapshot(ds, range);
  const set = ds.settings;
  const insights = generateInsights(ds, s).filter((i) => i.id.startsWith("weight") || i.id.startsWith("phase") || i.id === "tdee" || i.id.startsWith("nutrition.big"));
  const weighIns = s.days.filter((d) => d.weightKg != null).map((d) => kgToLb(d.weightKg!));
  const lbPerMoTarget = s.trendNowKg ? [set.rateMinPctPerMonth, set.rateMaxPctPerMonth].map((p) => kgToLb((p / 100) * s.trendNowKg!)) : null;

  // 8-week projection at current 28-day rate vs. target midpoint
  const proj = s.phaseRate && s.trendNowKg ? kgToLb(s.trendNowKg + s.phaseRate.kgPerWeek * 8) : null;

  return (
    <>
      <PageHeader title="Body" kicker="The scale doesn't lie, but it does fluctuate">
        <RangePicker range={range} path="/body" />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Trend now" value={s.trendNowKg ? kgToLb(s.trendNowKg) : null} digits={1} unit="lb" accent="pink" sub={`smoothed · ${rangeLabel(range)}`} />
        <Stat label="Range low / high" value={weighIns.length ? Math.min(...weighIns) : null} digits={1} unit={weighIns.length ? `– ${Math.max(...weighIns).toFixed(1)} lb` : ""} accent="purple" sub={`${weighIns.length} weigh-ins`} />
        <Stat label="Maintenance" value={s.tdee ? Math.round(s.tdee.kcal / 10) * 10 : null} unit="kcal" accent="sun" sub={s.tdee ? `adaptive · ${s.tdee.confidence} confidence` : "needs 18+ logged days"} />
        <Stat label="8-week projection" value={proj} digits={1} unit="lb" accent="cyan" sub="if this phase's rate holds" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card accent="pink" className="lg:col-span-8">
          <CardTitle sub={`EWMA trend (α = 0.1) smooths water and food weight · ${rangeLabel(range)}`}>Bodyweight trend</CardTitle>
          <WeightChart data={weightSeries(s.days)} height={360} phases={ds.phases.map((p) => ({ start: p.start, end: p.end, kind: p.kind }))} />
        </Card>
        <div className="grid gap-4 lg:col-span-4">
          <Card accent="mint">
            <CardTitle sub={`Within the current ${PHASE_LABEL[set.phase].toLowerCase()} phase`}>Rate of change</CardTitle>
            <RateGauge pctPerMonth={s.phaseRate?.pctPerMonth ?? null} settings={set} label={s.rateVerdict?.label ?? (judgesRate(set.phase) ? "Need more data" : "No rate goal")} tone={s.rateVerdict?.tone ?? null} />
            {lbPerMoTarget && (
              <p className="mt-3 text-center text-xs text-muted">
                Target ≈ <span className="text-mint">{lbPerMoTarget[0].toFixed(1)} to {lbPerMoTarget[1].toFixed(1)} lb/month</span> at your weight
              </p>
            )}
          </Card>
          <Card accent="sun">
            <CardTitle>Energy balance</CardTitle>
            {s.tdee ? (
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted">Avg intake (28d)</dt><dd className="text-right tabular-nums">{fmtInt(s.tdee.avgIntake)} kcal</dd>
                <dt className="text-muted">Trend change</dt><dd className="text-right tabular-nums">{kgToLb(s.tdee.trendDeltaKg) > 0 ? "+" : ""}{kgToLb(s.tdee.trendDeltaKg).toFixed(1)} lb</dd>
                <dt className="text-muted">Maintenance</dt><dd className="text-right font-semibold text-sun tabular-nums">{fmtInt(s.tdee.kcal)} kcal</dd>
                <dt className="text-muted">Target intake</dt><dd className="text-right font-semibold text-mint tabular-nums">{s.targetKcal ? `${fmtInt(s.targetKcal)} kcal` : "—"}</dd>
                <dt className="text-muted">Implied balance</dt><dd className="text-right tabular-nums">{s.tdee.avgIntake - s.tdee.kcal > 0 ? "+" : ""}{fmtInt(s.tdee.avgIntake - s.tdee.kcal)} kcal/day</dd>
              </dl>
            ) : <p className="text-sm text-muted">Log at least 18 of the last 28 days to estimate maintenance.</p>}
            <p className="mt-3 text-[11px] text-faint">Maintenance = avg intake − (trend change × 7,700 kcal/kg) ÷ days. {GUIDELINES["rate.surplus.small"].summary}</p>
          </Card>
        </div>
        <Card accent="pink" className="lg:col-span-12">
          <CardTitle>Coach on your body</CardTitle>
          <div className="grid gap-3 md:grid-cols-2"><InsightFeed insights={insights} /></div>
        </Card>
      </div>
    </>
  );
}
