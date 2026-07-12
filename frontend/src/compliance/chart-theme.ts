/**
 * Bridges the app's CSS design tokens (theme.css) into concrete color values Nivo can paint with.
 *
 * WHY THIS EXISTS: Nivo renders SVG and sets colors as `fill`/`stroke` — which do NOT resolve CSS custom
 * properties (`fill="var(--color-x)"` is inert as an SVG attribute). So a chart cannot consume our tokens
 * directly. Rather than hardcode hex (which would violate theme.css's single-swap-point guarantee — "do
 * not scatter hex into components"), we read the tokens' *computed* values off `:root` at call time. The
 * tokens stay the one source of truth; a palette swap in theme.css re-tints the charts for free.
 *
 * WHERE IT FITS: consumed by {@link ./VerdictDonut} and {@link ./RuleBreakdownChart}. Client-only (reads
 * `getComputedStyle`); the app has no SSR, so `document` is always present at render.
 *
 * SAFE EXTENSION: add a token to {@link ChartColors} + read it in {@link readChartColors}. REGRESSION TO
 * AVOID: do not hardcode a hex here — the whole point is to defer to theme.css. Read only *plain* color
 * tokens (Tailwind v4 emits these as resolved values on :root); do NOT read the `--glass-*` tokens, whose
 * computed value is an unresolved `color-mix(...)` string SVG cannot paint.
 */

/** The concrete chart palette, read from theme.css tokens. */
export interface ChartColors {
  /** PASS / healthy — teal. */
  readonly pass: string;
  /** FLAGGED / failure — red (colour re-architecture 2026-07-11). */
  readonly flagged: string;
  /** Primary text (ink) — Nivo labels/values. */
  readonly ink: string;
  /** Secondary text (muted) — axes, ticks, legends. */
  readonly muted: string;
  /** Hairlines — grid lines, axis domains, tooltip border. */
  readonly line: string;
  /** Inset surface — tooltip background. */
  readonly surface: string;
}

/** Read one CSS custom property's computed value off the document root. */
function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Read the current chart palette from theme.css. Cheap; call it in render so a future runtime theme
 * swap (the D17 one-file light/dark switch) is picked up without a reload.
 *
 * @returns concrete color strings for the charts, sourced from the live design tokens
 */
export function readChartColors(): ChartColors {
  return {
    pass: cssVar("--color-primary-bright"),
    flagged: cssVar("--color-danger-bright"),
    ink: cssVar("--color-ink"),
    muted: cssVar("--color-muted"),
    line: cssVar("--color-line"),
    surface: cssVar("--color-surface-2"),
  };
}

/**
 * A minimal Nivo {@code theme} object (text/axis/grid/tooltip) wired to our tokens, so every chart's
 * chrome reads as one material with the rest of the app rather than Nivo's light defaults.
 *
 * @param colors the palette from {@link readChartColors}
 * @returns a Nivo theme partial to pass as the `theme` prop
 */
export function nivoTheme(colors: ChartColors) {
  return {
    text: { fontFamily: "inherit", fontSize: 11, fill: colors.muted },
    axis: {
      domain: { line: { stroke: colors.line, strokeWidth: 1 } },
      ticks: {
        line: { stroke: colors.line, strokeWidth: 1 },
        text: { fill: colors.muted, fontSize: 11, fontFamily: "inherit" },
      },
      legend: { text: { fill: colors.muted, fontSize: 11 } },
    },
    grid: { line: { stroke: colors.line, strokeWidth: 1, strokeDasharray: "2 4" } },
    labels: { text: { fill: colors.ink, fontFamily: "inherit", fontWeight: 600 } },
    legends: { text: { fill: colors.muted, fontFamily: "inherit" } },
    tooltip: {
      container: {
        background: colors.surface,
        color: colors.ink,
        fontSize: 12,
        fontFamily: "inherit",
        borderRadius: 8,
        border: `1px solid ${colors.line}`,
        boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
      },
    },
  };
}
