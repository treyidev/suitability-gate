/**
 * The verdict-split donut — PASS vs FLAGGED across the whole ledger, with the flag-rate in the hole.
 *
 * Form (per the dataviz method): the job is a two-category part-to-whole with one headline number, so a
 * donut with a centred hero figure fits — the ring shows proportion, the hole states the flag rate. Only
 * two slices, both STATUS colours (teal PASS / red FLAGGED, our locked semantics — never arbitrary hues),
 * so identity is carried by a labelled legend beneath, never colour alone.
 *
 * Built on Nivo (@nivo/pie), themed to our tokens via {@link ./chart-theme}. The centre figure is an
 * overlaid absolutely-positioned element rather than an SVG text layer — it lets the flag rate use our
 * mono tabular numerals and ink tokens for a crisp KPI look, matching VerdictCard's KpiStat.
 *
 * WHERE IT FITS: a card in {@link ../screens/ComplianceDashboard}, fed by {@link ./compliance-metrics}
 * `VerdictBreakdown`.
 */
import { ResponsivePie } from "@nivo/pie";
import { useReducedMotion } from "motion/react";

import { nivoTheme, readChartColors } from "./chart-theme";

/** Props for {@link VerdictDonut} — the {@link ./compliance-metrics} verdict breakdown. */
interface VerdictDonutProps {
  readonly passed: number;
  readonly flagged: number;
  /** Flagged as a percentage of total (one decimal), shown in the donut hole. */
  readonly flagRatePct: number;
}

/** PASS/FLAGGED proportion as a donut with a flag-rate hero centre. */
export function VerdictDonut({ passed, flagged, flagRatePct }: VerdictDonutProps) {
  const reduceMotion = useReducedMotion();
  const colors = readChartColors();

  const data = [
    { id: "PASS", label: "Pass", value: passed, color: colors.pass },
    { id: "FLAGGED", label: "Flagged", value: flagged, color: colors.flagged },
  ];

  return (
    <div>
      <div className="relative h-52">
        <ResponsivePie
          data={data}
          margin={{ top: 6, right: 6, bottom: 6, left: 6 }}
          innerRadius={0.72}
          padAngle={1.4}
          cornerRadius={4}
          colors={{ datum: "data.color" }}
          borderWidth={0}
          enableArcLinkLabels={false}
          enableArcLabels={false}
          theme={nivoTheme(colors)}
          animate={!reduceMotion}
          motionConfig="gentle"
          isInteractive
          activeOuterRadiusOffset={5}
        />
        {/* Hero centre — flag rate. pointer-events-none so the ring keeps its hover. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-[30px] leading-none font-semibold tabular-nums text-ink">
            {flagRatePct}
            <span className="text-base font-medium text-muted">%</span>
          </span>
          <span className="mt-1 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">
            Flag rate
          </span>
        </div>
      </div>

      {/* Labelled legend — identity is never colour-alone (dataviz a11y). */}
      <div className="mt-3 flex items-center justify-center gap-6 text-[12px]">
        <LegendItem color={colors.pass} label="Pass" count={passed} />
        <LegendItem color={colors.flagged} label="Flagged" count={flagged} />
      </div>
    </div>
  );
}

/** One legend entry: a colour dot + label + count. */
function LegendItem({ color, label, count }: { color: string; label: string; count: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-medium text-ink">{label}</span>
      <span className="font-mono tabular-nums">{count}</span>
    </span>
  );
}
