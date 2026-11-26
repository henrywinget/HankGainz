/**
 * Global SVG gradients + glow filter, referenced by id from every chart (url(#neon), url(#g-purple)…).
 * Recharts doesn't render arbitrary <defs> children, so these live once in the layout.
 * Not display:none: browsers stop resolving gradients inside hidden SVGs.
 */
export function ChartDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
      <defs>
        <filter id="neon" x="-20%" y="-50%" width="140%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="g-pink" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff2a6d" stopOpacity={0.45} /><stop offset="100%" stopColor="#ff2a6d" stopOpacity={0} /></linearGradient>
        <linearGradient id="g-cyan" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#05d9e8" stopOpacity={0.4} /><stop offset="100%" stopColor="#05d9e8" stopOpacity={0} /></linearGradient>
        <linearGradient id="g-purple" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b967ff" stopOpacity={0.95} /><stop offset="100%" stopColor="#b967ff" stopOpacity={0.3} /></linearGradient>
      </defs>
    </svg>
  );
}
