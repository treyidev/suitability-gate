/**
 * The rule-firing breakdown — for each rule, how often it failed vs passed across the whole ledger.
 *
 * Form (dataviz method): the job is comparing a magnitude (failures) across a small set of identities
 * (the four rules), so a horizontal bar is right — horizontal because the rule names are words, and the
 * eye compares bar *lengths* along a shared baseline. Each bar is stacked failed↦passed with FAILED
 * anchored at the axis, so failure counts start at zero and are directly comparable rule-to-rule (the
 * compliance question is "which rule trips most"). Two STATUS series (red failed / teal passed) with a
 * labelled legend, a 2px surface gap between the segments, and rounded ends — the dataviz mark specs.
 *
 * This is the compelling widget: it makes the deterministic engine's behaviour legible at a glance —
 * exactly what a supervisor wants before drilling into individual records.
 *
 * WHERE IT FITS: a card in {@link ../screens/ComplianceDashboard}, fed by {@link ./compliance-metrics}
 * `RuleStat[]` (already in canonical engine order).
 */
import { ResponsiveBar } from "@nivo/bar";
import { useReducedMotion } from "motion/react";

import { humanizeToken } from "../format";
import { nivoTheme, readChartColors } from "./chart-theme";
import type { RuleStat } from "./compliance-metrics";

/** Props for {@link RuleBreakdownChart}. */
interface RuleBreakdownChartProps {
  /** Per-rule stats in canonical engine order (from {@link ./compliance-metrics}). */
  readonly rules: readonly RuleStat[];
}

/** Horizontal stacked bars — failed vs passed per rule, failures anchored at the axis. */
export function RuleBreakdownChart({ rules }: RuleBreakdownChartProps) {
  const reduceMotion = useReducedMotion();
  const colors = readChartColors();

  // Bottom-to-first-key = axis-anchored. "failed" first ⇒ red segments all start at 0, so failure
  // counts line up across rules. Label carries the humanised rule name for the left axis.
  const data = rules.map((r) => ({
    rule: humanizeToken(r.ruleId),
    failed: r.failed,
    passed: r.passed,
  }));

  return (
    <div>
      <div className="h-56">
        <ResponsiveBar
          data={data}
          keys={["failed", "passed"]}
          indexBy="rule"
          layout="horizontal"
          margin={{ top: 4, right: 14, bottom: 28, left: 118 }}
          padding={0.4}
          innerPadding={2}
          borderRadius={3}
          valueScale={{ type: "linear" }}
          indexScale={{ type: "band", round: true }}
          colors={({ id }) => (id === "failed" ? colors.flagged : colors.pass)}
          enableGridX
          enableGridY={false}
          axisBottom={{ tickSize: 0, tickPadding: 6 }}
          axisLeft={{ tickSize: 0, tickPadding: 8 }}
          enableLabel
          label={(d) => (d.id === "failed" && typeof d.value === "number" && d.value > 0 ? String(d.value) : "")}
          labelSkipWidth={12}
          labelTextColor={colors.ink}
          theme={nivoTheme(colors)}
          animate={!reduceMotion}
          motionConfig="gentle"
        />
      </div>

      {/* Labelled legend — identity never colour-alone (dataviz a11y). */}
      <div className="flex items-center justify-center gap-6 text-[12px]">
        <LegendItem color={colors.flagged} label="Failed" />
        <LegendItem color={colors.pass} label="Passed" />
      </div>
    </div>
  );
}

/** One legend entry: a colour dot + label. */
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="font-medium text-ink">{label}</span>
    </span>
  );
}
