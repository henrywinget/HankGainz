import { Suspense } from "react";
import type { Metadata } from "next";
import { loadDataset } from "@/lib/dataset";
import { parseRange, rangeLabel } from "@/lib/range";
import { buildSnapshot } from "@/insights/snapshot";
import { generateInsights } from "@/insights/rules";
import { Card, CardTitle, InsightFeed, PageHeader, PageSkeleton, RangePicker, Stat, TargetBar } from "@/components/ui";
import { CaloriesChart, MacroChart, ProteinChart } from "@/components/charts";
import { caloriesSeries, macroSeries, proteinSeries } from "@/lib/series";
import { fmtInt, fmtGPerLb, gPerKgToGPerLb } from "@/lib/units";
import { fmtShort } from "@/lib/dates";
import { mean } from "@/metrics/stats";

export const metadata: Metadata = { title: "Nutrition" };

export default function NutritionPage(props: PageProps<"/nutrition">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Nutrition searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Nutrition({ searchParams }: { searchParams: PageProps<"/nutrition">["searchParams"] }) {
  const range = parseRange((await searchParams).range, 30);
  const ds = await loadDataset();
  const s = buildSnapshot(ds, range);
  const set = ds.settings;
  const insights = generateInsights(ds, s).filter((i) => i.id.startsWith("protein") || i.id.startsWith("nutrition") || i.id === "tdee");
  const logged = s.days.filter((d) => d.kcal != null && !d.isFast);
  const macroKcal = logged.length
    ? { p: mean(logged.map((d) => d.proteinG! * 4)), c: mean(logged.map((d) => d.carbsG! * 4)), f: mean(logged.map((d) => d.fatG! * 9)) }
    : null;
  const totalMacro = macroKcal ? macroKcal.p + macroKcal.c + macroKcal.f : 0;
  const weekday = weekdayPattern(s.days);
  const proteinFloorG = s.trendNowKg ? set.proteinMinGPerKg * s.trendNowKg : null;

  return (
    <>
      <PageHeader title="Nutrition" kicker="Every logged day counts, fasts and feasts included">
        <RangePicker range={range} path="/nutrition" />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <Stat label="Avg calories" value={s.avgKcal} unit="kcal" accent="sun" sub={`median ${fmtInt(s.medianKcal)} · ${s.loggedDays} days`} />
        <Stat label="Avg protein" value={s.avgProteinG} unit="g" accent="pink" sub={proteinFloorG ? `floor ${fmtInt(proteinFloorG)} g (${fmtGPerLb(set.proteinMinGPerKg)} g/lb)` : undefined} />
        <Stat label="Fast days" value={s.fastDays} accent="cyan" sub={rangeLabel(range)} />
        <Stat label="Blowout days" value={s.bigDays.length} accent="red" sub="> 2× median kcal" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-12">
        <Card accent="sun" className="lg:col-span-8">
          <CardTitle sub="Bars = daily kcal · gold = 7-day average · dashed = target">Calories</CardTitle>
          <CaloriesChart data={caloriesSeries(s.days)} target={s.targetKcal} height={320} />
        </Card>
        <Card accent="pink" className="lg:col-span-4">
          <CardTitle sub="Share of calories, non-fast days">Macro split</CardTitle>
          {macroKcal ? (
            <div className="space-y-4">
              <div className="flex h-4 overflow-hidden rounded-full">
                <div style={{ width: `${(macroKcal.p / totalMacro) * 100}%`, background: "var(--pink)", boxShadow: "0 0 12px var(--pink)" }} />
                <div style={{ width: `${(macroKcal.c / totalMacro) * 100}%`, background: "var(--cyan)" }} />
                <div style={{ width: `${(macroKcal.f / totalMacro) * 100}%`, background: "var(--sun)" }} />
              </div>
              {[
                { k: "Protein", v: macroKcal.p / 4, pct: macroKcal.p / totalMacro, c: "var(--pink)" },
                { k: "Carbs", v: macroKcal.c / 4, pct: macroKcal.c / totalMacro, c: "var(--cyan)" },
                { k: "Fat", v: macroKcal.f / 9, pct: macroKcal.f / totalMacro, c: "var(--sun)" },
              ].map((m) => (
                <div key={m.k} className="flex items-center gap-3 text-sm">
                  <span className="size-2.5 rounded-full" style={{ background: m.c, boxShadow: `0 0 8px ${m.c}` }} />
                  <span className="text-muted">{m.k}</span>
                  <span className="ml-auto font-display tabular-nums">{Math.round(m.v)} g</span>
                  <span className="w-12 text-right text-faint tabular-nums">{Math.round(m.pct * 100)}%</span>
                </div>
              ))}
              <div className="border-t border-line pt-4">
                <CardTitle sub="Per-meal target 20–40 g">Protein by meal</CardTitle>
                <div className="space-y-3">
                  {s.mealProtein.map((m) => (
                    <TargetBar key={m.meal} label={`${m.meal} (${m.days})`} value={m.avgG} min={20} max={40} scaleMax={Math.max(70, m.avgG + 5)} format={(n) => `${Math.round(n)}g`} />
                  ))}
                </div>
              </div>
            </div>
          ) : <p className="text-sm text-muted">No logged days in range.</p>}
        </Card>

        <Card accent="mint" className="lg:col-span-6">
          <CardTitle sub={`Mint band = your ${fmtGPerLb(set.proteinMinGPerKg)}–${fmtGPerLb(set.proteinMaxGPerKg)} g/lb target · fast days hidden`}>Protein per lb bodyweight</CardTitle>
          <ProteinChart data={proteinSeries(s.days)} min={gPerKgToGPerLb(set.proteinMinGPerKg)} max={gPerKgToGPerLb(set.proteinMaxGPerKg)} />
        </Card>
        <Card accent="cyan" className="lg:col-span-6">
          <CardTitle sub="Calories from each macro">Macros by day</CardTitle>
          <MacroChart data={macroSeries(s.days)} height={240} />
        </Card>

        <Card accent="purple" className="lg:col-span-5">
          <CardTitle sub="Average kcal by weekday (non-fast days)">Weekly rhythm</CardTitle>
          <div className="space-y-2">
            {weekday.map((w) => (
              <TargetBar key={w.day} label={w.day} value={w.kcal} min={s.targetKcal ? s.targetKcal * 0.95 : 0} max={s.targetKcal ? s.targetKcal * 1.05 : undefined} scaleMax={Math.max(...weekday.map((x) => x.kcal ?? 0), s.targetKcal ?? 0) * 1.1 || 1} format={(n) => fmtInt(n)} accent="purple" />
            ))}
          </div>
        </Card>
        <Card accent="red" className="lg:col-span-7">
          <CardTitle sub="Logged honestly, counted honestly">Fasts & blowouts</CardTitle>
          <div className="grid gap-2 sm:grid-cols-2">
            {[...s.days.filter((d) => d.isFast).map((d) => ({ d, kind: "fast" as const })), ...s.bigDays.map((d) => ({ d, kind: "big" as const }))]
              .sort((a, b) => b.d.date.localeCompare(a.d.date))
              .slice(0, 12)
              .map(({ d, kind }) => (
                <div key={d.date} className="flex items-center justify-between rounded-xl border border-line bg-white/3 px-3 py-2 text-sm">
                  <span className="text-muted">{fmtShort(d.date)}</span>
                  <span className={kind === "fast" ? "text-cyan" : "text-red"}>{kind === "fast" ? "Fast" : `${fmtInt(d.kcal)} kcal`}</span>
                </div>
              ))}
            {!s.fastDays && !s.bigDays.length && <p className="text-sm text-faint">None in this window.</p>}
          </div>
        </Card>

        <Card accent="pink" className="lg:col-span-12">
          <CardTitle>Coach on your nutrition</CardTitle>
          <div className="grid gap-3 md:grid-cols-2"><InsightFeed insights={insights} /></div>
        </Card>
      </div>
    </>
  );
}

function weekdayPattern(days: { date: string; kcal: number | null; isFast: boolean }[]) {
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const buckets: number[][] = names.map(() => []);
  for (const d of days) {
    if (d.kcal == null || d.isFast) continue;
    const dow = (new Date(`${d.date}T00:00:00Z`).getUTCDay() + 6) % 7;
    buckets[dow].push(d.kcal);
  }
  return names.map((day, i) => ({ day, kcal: buckets[i].length ? mean(buckets[i]) : null }));
}
