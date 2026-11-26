import { desc } from "drizzle-orm";
import { getDb } from "@/db/client";
import { digests } from "@/db/schema";
import { Card, CardTitle } from "./ui";
import { DigestButton } from "./digest-button";
import { hasApiCredentials, type Digest } from "@/insights/digest";
import { fmtShort } from "@/lib/dates";

const VERDICT: Record<Digest["verdict"], { label: string; color: string }> = {
  crushing_it: { label: "Crushing it", color: "var(--mint)" },
  on_track: { label: "On track", color: "var(--cyan)" },
  mixed: { label: "Mixed", color: "var(--orange)" },
  off_track: { label: "Off track", color: "var(--red)" },
};

/** Latest AI-written weekly digest (opt-in). Call only from request-time (dynamic) components. */
export function DigestCard() {
  const db = getDb();
  const latest = db.select().from(digests).orderBy(desc(digests.createdAt)).limit(1).get();
  const enabled = hasApiCredentials();
  const d = latest?.content as Digest | undefined;
  const v = d ? VERDICT[d.verdict] : null;

  return (
    <Card accent="purple">
      <CardTitle
        sub={latest ? `Week of ${fmtShort(latest.weekStart)} · written by Claude` : "AI coach summary of your last complete week"}
        right={v && <span className="rounded-full border px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-wider" style={{ color: v.color, borderColor: v.color }}>{v.label}</span>}
      >
        Weekly digest
      </CardTitle>

      {d ? (
        <div className="space-y-3 text-sm">
          <h3 className="text-lg font-semibold leading-snug">{d.headline}</h3>
          <p className="leading-relaxed text-muted">{d.summary}</p>
          {d.wins.length > 0 && (
            <ul className="space-y-1">{d.wins.map((w) => <li key={w} className="flex gap-2"><span className="text-mint">▲</span><span>{w}</span></li>)}</ul>
          )}
          {d.realityChecks.length > 0 && (
            <ul className="space-y-1">{d.realityChecks.map((w) => <li key={w} className="flex gap-2"><span className="text-red">▼</span><span>{w}</span></li>)}</ul>
          )}
          <div className="rounded-xl border border-line bg-white/3 p-3">
            <p className="mb-2 font-display text-[10px] font-bold uppercase tracking-[0.2em] text-pink">This week&apos;s focus</p>
            <ol className="space-y-2">
              {d.focus.map((f, i) => (
                <li key={f.action} className="flex gap-2">
                  <span className="font-display text-cyan">{i + 1}</span>
                  <span><span className="font-medium">{f.action}</span> <span className="text-muted">{f.why}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted">
          {enabled ? "Claude reads your weekly totals and the coach's findings, then writes a short check-in with three things to focus on." : <>To turn this on, add <code className="rounded bg-white/5 px-1 text-cyan">ANTHROPIC_API_KEY=…</code> to <code className="rounded bg-white/5 px-1 text-cyan">.env.local</code> and restart the dev server.</>}
        </p>
      )}

      <div className="mt-4"><DigestButton hasDigest={!!d} enabled={enabled} /></div>

      <details className="mt-3 text-[11px] text-faint">
        <summary className="cursor-pointer hover:text-muted">What gets sent?</summary>
        <p className="mt-1">Only weekly averages and totals, your targets, the coach&apos;s rule-based findings and the guideline summaries. No raw files, meal or exercise logs, notes, or device names. Nothing is sent unless you press the button.</p>
        {latest && <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-black/30 p-2 text-[10px] leading-relaxed">{JSON.stringify(latest.payload, null, 2)}</pre>}
        {latest && <p className="mt-1">Model: {latest.model}{latest.inputTokens != null && ` · ${latest.inputTokens.toLocaleString()} in / ${latest.outputTokens?.toLocaleString()} out tokens`}</p>}
      </details>
    </Card>
  );
}
