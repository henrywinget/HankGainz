"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Dumbbell, Flag, Gauge, Network, Scale, Settings, Upload, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/cn";

const LINKS = [
  { href: "/", label: "Overview", icon: Gauge },
  { href: "/goals", label: "Goals", icon: Flag },
  { href: "/body", label: "Body", icon: Scale },
  { href: "/nutrition", label: "Nutrition", icon: UtensilsCrossed },
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/relationships", label: "Connections", icon: Network },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("group inline-flex items-baseline gap-1 select-none", className)}>
      <span className="font-script text-4xl leading-none text-pink glow-pink -rotate-6 inline-block">Hank</span>
      <span className="font-display text-xl font-black italic tracking-widest chrome-text">GAINZ</span>
    </Link>
  );
}

export function Nav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-8 border-r border-line bg-bg/40 px-5 py-7 backdrop-blur-xl lg:flex">
        <Logo />
        <nav className="flex flex-col gap-1">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active(href) ? "bg-pink/12 text-text shadow-[inset_2px_0_0_var(--pink)]" : "text-muted hover:bg-white/5 hover:text-text",
              )}
            >
              <Icon className={cn("size-4.5 transition", active(href) ? "text-pink drop-shadow-[0_0_6px_var(--pink)]" : "text-faint group-hover:text-cyan")} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto flex items-center gap-2 text-xs text-faint">
          <Activity className="size-3.5 text-cyan" /> Local only. Your data stays here.
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex justify-around border-t border-line bg-bg/85 px-1 py-2 backdrop-blur-xl lg:hidden">
        {LINKS.filter((l) => l.href !== "/settings" && l.href !== "/import").map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn("flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 text-[10px]", active(href) ? "text-pink" : "text-muted")}>
            <Icon className={cn("size-5", active(href) && "drop-shadow-[0_0_6px_var(--pink)]")} />
            {label}
          </Link>
        ))}
      </nav>
    </>
  );
}
