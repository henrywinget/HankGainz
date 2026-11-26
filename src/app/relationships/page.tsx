import { Suspense } from "react";
import type { Metadata } from "next";
import { loadDataset } from "@/lib/dataset";
import { parseRange, rangeLabel } from "@/lib/range";
import { windowDays } from "@/lib/dataset";
import { Card, CardTitle, PageHeader, PageSkeleton, RangePicker } from "@/components/ui";
import { OverlayChart, RelationScatter, type FormatKey } from "@/components/charts";
import { computeRelations, overlaySeries, type Relation } from "@/metrics/relationships";

export const metadata: Metadata = { title: "Connections" };

export default function RelationshipsPage(props: PageProps<"/relationships">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Relationships searchParams={props.searchParams} />
    </Suspense>
  );
}

const STRENGTH_COLOR: Record<Relation["strength"], string> = {
  insufficient: "var(--faint)", none: "var(--muted)", weak: "var(--cyan)", moderate: "var(--sun)", strong: "var(--pink)",
};

const META: Record<string, { title: string; color: string; xFormat?: FormatKey; yFormat?: FormatKey }> = {
  kcal_weight: { title: "Calories → weight change", color: "#ffd319", xFormat: "thousands1", yFormat: "signed1" },
  perf_kcal: { title: "Prior calories → session performance", color: "#ff9e3d", xFormat: "thousands1", yFormat: "int" },
  perf_protein: { title: "Prior protein → session performance", color: "#ff4fd8", xFormat: "int", yFormat: "int" },
  perf_steps: { title: "Yesterday's steps → session performance", color: "#05d9e8", xFormat: "thousands0", yFormat: "int" },
  steps_kcal: { title: "Steps ↔ calories (same day)", color: "#b967ff", xFormat: "thousands0", yFormat: "thousands1" },
};

async function Relationships({ searchParams }: { searchParams: PageProps<"/relationships">["searchParams"] }) {
  const range = parseRange((await searchParams).range, 90);
  const ds = await loadDataset();
  const days = windowDays(ds, range);
  const relations = computeRelations(ds, days);
  const overlay = overlaySeries(days);

  return (
    <>
      <PageHeader title="Connections" kicker="How it all fits together">
        <RangePicker range={range} path="/relationships" />
      </PageHeader>

      <Card accent="purple">
        <CardTitle sub={`Steps, nutrition, bodyweight and performance on one timeline · ${rangeLabel(range)}`}>Everything, overlaid</CardTitle>
        <OverlayChart data={overlay} />
      </Card>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {relations.map((r) => {
          const m = META[r.id];
          return (
            <Card key={r.id} accent={r.strength === "strong" ? "pink" : r.strength === "moderate" ? "sun" : "cyan"}>
              <CardTitle
                sub={`${r.x} vs ${r.y}`}
                right={
                  <span className="shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider" style={{ color: STRENGTH_COLOR[r.strength], borderColor: STRENGTH_COLOR[r.strength] }}>
                    {r.r == null ? `n=${r.n}` : `r ${r.r > 0 ? "+" : ""}${r.r.toFixed(2)}`}
                  </span>
                }
              >
                {m.title}
              </CardTitle>
              {r.points.length ? <RelationScatter points={r.points} fit={r.fit} xLabel={r.x} yLabel={r.y} color={m.color} xFormat={m.xFormat} yFormat={m.yFormat} /> :<div className="flex h-[230px] items-center justify-center text-sm text-faint">No data in range</div>}
              <p className="mt-2 text-sm leading-relaxed text-muted">{r.note}</p>
              <p className="mt-1 text-[11px] text-faint">n = {r.n} · {r.strength === "insufficient" ? "not enough data" : `${r.strength} correlation`}</p>
            </Card>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[11px] text-faint">
        These are correlations in your own data, not proof of cause and effect. Session performance = best e1RM on key lifts vs. your best in the prior 60 days (100 = matched it).
      </p>
    </>
  );
}
