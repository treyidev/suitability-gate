/**
 * SEBI Riskometer gauge — the signature instrument (UI Modernization Directive §6.5).
 *
 * WHY THIS EXISTS: the mentors listed "SEBI Risk-o-Meter integration" as a wanted feature, and we
 * already carry every scheme's `riskometerLevel`. This renders that value as a compact instrument — a
 * horizontal six-segment LED meter that fills to the scheme's risk level — rather than as one more text
 * chip. It is judge-bait with substance: the visual proves the feature using data the pipeline already
 * froze into the record.
 *
 * WHERE IT FITS: presentation layer only, strictly downstream of the frozen record — it reads nothing
 * but its `level` prop (no fetch, no state beyond the segments' light-up animation). Two call sites,
 * each passing a raw backend riskometer string: the RM workbench scheme picker
 * ({@link ../screens/RmWorkbench}, `sm`) and the verdict card's KPI provenance strip
 * ({@link ./VerdictCard}, `md`).
 *
 * DESIGN DECISIONS:
 *  - EVOKE, NEVER COPY the regulator's dial. SEBI's meter runs green→red, but red here is reserved for
 *    the FLAGGED verdict (colour re-architecture 2026-07-11): a high-risk scheme is a *fact*, not a
 *    *failure*. So the ramp runs teal→amber→orange and VERY_HIGH is a deep orange, never red. The tints
 *    are token-derived (`--color-risk-1..6` in theme.css, `color-mix` over the brand anchors), so a
 *    palette swap re-tints the gauge and the D17 one-file-theme guarantee holds — zero hex lives here.
 *  - HORIZONTAL FILL-TO-LEVEL LED array (owner-directed 2026-07-11, final form — superseding the arc +
 *    needle, which floated off its pivot, and then the arc-fill). A straight left→right row of six
 *    rounded bars: every bar from LOW up to AND INCLUDING the active tier lights at full saturation —
 *    each in its own ramp colour, each with a soft same-colour glow — while every bar ABOVE the active
 *    tier stays a dim "off" LED. How far the light travels along the row, not a needle, communicates
 *    risk. The topmost-lit tier (the active one) carries extra weight — a touch taller + a brighter,
 *    tighter-cored glow — so the level is unmistakable.
 *  - MOTION is the LEDs lighting on: a low-amplitude opacity glow (`springGentle`), staggered LOW→active
 *    for a tasteful "charging up" read (≤40 ms steps — below the toy threshold, nothing loops). Collapsed
 *    to an instant lit state under `useReducedMotion`.
 *  - FAIL-SOFT on an unknown tier. types.ts deliberately types `riskometerLevel` as a free `string` so
 *    a new backend enum value renders instead of breaking the build; honouring that, an unrecognised
 *    level lights nothing (every LED stays dim) rather than throwing.
 *
 * SAFE EXTENSIONS: add a `size` variant or tick labels under the row — pure layout off the size config.
 * REGRESSIONS TO AVOID: (1) never introduce red into the ramp — it would collide with the FLAGGED
 * semantics; (2) never reorder {@link RISK_TIERS} away from the backend `RiskometerLevel` ascending
 * order — the lit set is exactly `index ≤ activeIndex`; (3) do not inline raw spring numbers — import
 * them from `../motion`.
 */
import { motion, useReducedMotion } from "motion/react";

import { humanizeLabel } from "../format";
import { springGentle } from "../motion";

/**
 * SEBI riskometer tiers in ascending risk order — the single source of truth for how far the row fills.
 * MUST mirror the backend `RiskometerLevel` enum declaration order (shared module); index 0 = LOW
 * (lights only the leftmost LED) … index 5 = VERY_HIGH (lights the whole row).
 */
const RISK_TIERS = [
  "LOW",
  "LOW_TO_MODERATE",
  "MODERATE",
  "MODERATELY_HIGH",
  "HIGH",
  "VERY_HIGH",
] as const;

/** LEDs above the active tier — the dim "off" state. Low enough to read as unlit, visible enough that
 *  the row's full length still shows (so the fill level reads as a proportion). */
const OFF_SEGMENT_OPACITY = 0.2;

/** Per-segment charge-up delay (LOW→active) — ≤40 ms steps for a tasteful, non-toy sweep. */
const CHARGE_STAGGER_S = 0.035;

/** Per-size geometry, in px. `sm` = compact proposal panel; `md` = verdict KPI strip. */
interface GaugeGeometry {
  readonly barWidth: number;
  readonly barHeight: number;
  /** Extra height on the topmost-lit (active) LED — the "you are here" emphasis. */
  readonly activeBump: number;
  readonly gap: number;
  readonly radius: number;
  readonly litBlur: number;
  readonly activeBlur: number;
}

const SIZE_GEOMETRY: Record<"sm" | "md", GaugeGeometry> = {
  sm: { barWidth: 14, barHeight: 9, activeBump: 3, gap: 3, radius: 3, litBlur: 6, activeBlur: 10 },
  md: { barWidth: 18, barHeight: 11, activeBump: 4, gap: 4, radius: 3.5, litBlur: 8, activeBlur: 13 },
};

/** Props for {@link RiskometerGauge}. */
interface RiskometerGaugeProps {
  /** Raw backend riskometer token (e.g. `VERY_HIGH`); an unrecognised value renders the neutral state. */
  readonly level: string;
  /** `sm` — scheme picker (row + tiny tier label); `md` — verdict KPI strip (row + caption + tier). */
  readonly size?: "sm" | "md";
}

/** The SEBI Riskometer — a horizontal six-LED meter that fills to the scheme's risk level. */
export function RiskometerGauge({ level, size = "md" }: RiskometerGaugeProps) {
  const reduceMotion = useReducedMotion();
  const geo = SIZE_GEOMETRY[size];

  const activeIndex = RISK_TIERS.indexOf(level as (typeof RISK_TIERS)[number]);
  const known = activeIndex >= 0;

  const tierLabel = humanizeLabel(level);
  const tierColor = known ? `var(--color-risk-${activeIndex + 1})` : "var(--color-muted)";

  // Row of LEDs — bottom-aligned so the taller active LED peaks upward like a level marker.
  const ledRow = (
    <div className="flex items-end" style={{ gap: `${geo.gap}px` }} aria-hidden="true">
      {RISK_TIERS.map((tier, i) => {
        const lit = known && i <= activeIndex;
        const isActive = known && i === activeIndex;
        const rampColor = `var(--color-risk-${i + 1})`;
        // Same-colour glow only while lit; the active LED glows wider + tighter-cored for emphasis.
        const glow = isActive
          ? `0 0 ${geo.activeBlur}px color-mix(in srgb, ${rampColor} 75%, transparent), 0 0 3px ${rampColor}`
          : lit
            ? `0 0 ${geo.litBlur}px color-mix(in srgb, ${rampColor} 55%, transparent)`
            : "none";
        return (
          <motion.span
            key={tier}
            initial={{ opacity: reduceMotion ? (lit ? 1 : OFF_SEGMENT_OPACITY) : OFF_SEGMENT_OPACITY }}
            animate={{ opacity: lit ? 1 : OFF_SEGMENT_OPACITY }}
            transition={
              reduceMotion ? { duration: 0 } : { ...springGentle, delay: lit ? i * CHARGE_STAGGER_S : 0 }
            }
            style={{
              width: `${geo.barWidth}px`,
              height: `${geo.barHeight + (isActive ? geo.activeBump : 0)}px`,
              borderRadius: `${geo.radius}px`,
              backgroundColor: rampColor,
              boxShadow: glow,
            }}
          />
        );
      })}
    </div>
  );

  // The instrument is labelled "SEBI Riskometer" (SEBI's own official term for the mandated product-risk
  // disclosure) in BOTH size variants — owner-directed 2026-07-11 so the regulatory framing is visible to
  // judges everywhere the gauge appears, not only on the verdict card. The text readout duplicates the
  // parent's aria-label, so it is decorative for assistive tech.
  const caption = (
    <span
      className={
        size === "md"
          ? "text-[10px] font-semibold tracking-[0.12em] text-muted uppercase"
          : "text-[9px] font-semibold tracking-[0.12em] text-muted uppercase"
      }
      aria-hidden="true"
    >
      SEBI Riskometer
    </span>
  );

  return size === "md" ? (
    <div className="flex items-center gap-3" role="img" aria-label={`SEBI Riskometer: ${tierLabel}`}>
      {ledRow}
      <div className="flex flex-col" aria-hidden="true">
        {caption}
        <span className="mt-0.5 text-[15px] leading-none font-semibold" style={{ color: tierColor }}>
          {tierLabel}
        </span>
      </div>
    </div>
  ) : (
    <div
      className="flex flex-col items-center gap-1.5"
      role="img"
      aria-label={`SEBI Riskometer: ${tierLabel}`}
    >
      {caption}
      {ledRow}
      <span className="text-[11px] font-semibold" style={{ color: tierColor }} aria-hidden="true">
        {tierLabel}
      </span>
    </div>
  );
}
