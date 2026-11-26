import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getDb } from "@/db/client";
import { readSettings } from "@/lib/settings";
import { Card, CardTitle, PageHeader, PageSkeleton } from "@/components/ui";
import { SettingsForm } from "@/components/settings-form";
import { GUIDELINES } from "@/guidelines";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" kicker="Your goals, your rules" />
      <Suspense fallback={<PageSkeleton />}>
        <SettingsContent />
      </Suspense>
    </>
  );
}

async function SettingsContent() {
  await connection();
  const settings = readSettings(getDb());
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <Card accent="pink" className="lg:col-span-7">
        <CardTitle sub="Defaults come from the guidelines on the right. Override anything.">Targets</CardTitle>
        <SettingsForm settings={settings} />
      </Card>
      <Card accent="cyan" className="lg:col-span-5">
        <CardTitle sub="Grade A = position stand / meta-analysis · B = trials · C = rule of thumb">Evidence behind the defaults</CardTitle>
        <ul className="space-y-3">
          {Object.values(GUIDELINES).map((g) => (
            <li key={g.id} className="rounded-xl border border-line bg-white/3 p-3">
              <div className="flex items-center gap-2">
                <span className="rounded-md px-1.5 py-0.5 font-display text-[10px] font-bold" style={{ color: g.grade === "A" ? "var(--mint)" : g.grade === "B" ? "var(--sun)" : "var(--muted)", background: "rgb(255 255 255 / 0.05)" }}>{g.grade}</span>
                <span className="text-sm font-medium">{g.title}</span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted">{g.summary}</p>
              <p className="mt-1 text-[11px] text-faint">{"url" in g && g.url ? <a href={g.url} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-cyan">{g.source}</a> : g.source}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
