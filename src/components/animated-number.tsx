"use client";

import { useEffect, useRef } from "react";
import { animate, useInView } from "motion/react";

/** Counts up from 0 to `value` when it scrolls into view. */
export function AnimatedNumber({ value, digits = 0 }: { value: number; digits?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

  useEffect(() => {
    if (!inView || !ref.current) return;
    const node = ref.current;
    const controls = animate(0, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { node.textContent = fmt(v); },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, digits]);

  return <span ref={ref}>{fmt(value)}</span>;
}
