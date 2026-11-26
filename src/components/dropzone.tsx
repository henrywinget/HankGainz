"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleSlash, Loader2, RotateCcw, UploadCloud, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ImportOutcome } from "@/ingest/importer";

const ICON = {
  imported: <CheckCircle2 className="size-4 text-mint" />,
  skipped_duplicate: <RotateCcw className="size-4 text-cyan" />,
  ignored: <CircleSlash className="size-4 text-faint" />,
  error: <XCircle className="size-4 text-red" />,
};

export function Dropzone() {
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<ImportOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  async function upload(files: FileList | File[]) {
    const list = [...files];
    if (!list.length) return;
    setBusy(true);
    setError(null);
    setResults(null);
    const fd = new FormData();
    for (const f of list) fd.append("files", f);
    try {
      const res = await fetch("/api/import", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? res.statusText);
      setResults(json.results);
      startTransition(() => router.refresh());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        disabled={busy}
        className={cn(
          "group flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
          drag ? "border-pink bg-pink/10 shadow-[0_0_40px_-10px_var(--pink)]" : "border-line-strong hover:border-cyan hover:bg-cyan/5",
        )}
      >
        {busy ? <Loader2 className="size-10 animate-spin text-cyan" /> : <UploadCloud className={cn("size-10 transition", drag ? "text-pink" : "text-muted group-hover:text-cyan")} />}
        <div>
          <p className="font-display text-sm font-bold uppercase tracking-widest">{busy ? "Crunching…" : "Drop exports here"}</p>
          <p className="mt-1 text-xs text-faint">Strong CSV · MyFitnessPal ZIP or CSVs · Apple Health export.zip. Duplicates are skipped automatically.</p>
        </div>
      </button>
      <input ref={input} type="file" multiple accept=".zip,.csv,.xml" className="hidden" onChange={(e) => e.target.files && upload(e.target.files)} />

      {error && <p className="mt-3 text-sm text-red">{error}</p>}
      {results && (
        <ul className="mt-4 space-y-2">
          {results.map((r, i) => (
            <li key={i} className="rounded-xl border border-line bg-white/3 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                {ICON[r.status]}
                <span className="truncate">{r.fileName}</span>
                <span className="ml-auto shrink-0 text-xs text-faint">{r.status === "imported" ? `${r.rowsWritten.toLocaleString()} rows` : r.message}</span>
              </div>
              {r.warnings.map((w) => <p key={w} className="mt-1 pl-6 text-xs text-orange">⚠ {w}</p>)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
