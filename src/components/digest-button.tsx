"use client";

import { useActionState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { generateDigest, type ActionState } from "@/app/actions";
import { cn } from "@/lib/cn";

export function DigestButton({ hasDigest, enabled }: { hasDigest: boolean; enabled: boolean }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(generateDigest, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-3">
      <button
        disabled={pending || !enabled}
        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-purple to-pink px-4 py-2 font-display text-[11px] font-bold uppercase tracking-widest text-white shadow-[0_0_22px_-6px_var(--pink)] transition hover:brightness-110 disabled:opacity-50"
      >
        {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
        {pending ? "Writing…" : hasDigest ? "Refresh digest" : "Write weekly digest"}
      </button>
      {state && <span className={cn("text-xs", state.ok ? "text-mint" : "text-red")}>{state.message}</span>}
    </form>
  );
}
