/**
 * The ROLE_COMPLIANCE face — the supervisor's dashboard over the whole decision ledger.
 *
 * WHY THIS EXISTS: compliance needs the bird's-eye view the RM workbench (one decision at a time) can't
 * give — how many decisions, how often flagged, which rules trip most — plus a way into any individual
 * record. It replaces the former "Phase 2" placeholder screen; the owner pulled it into the July-13 slice
 * (2026-07-11), built "rich frontend, least backend": everything here is derived client-side from the
 * whole-ledger read (see {@link ../compliance/compliance-metrics}), so no aggregate endpoints were needed.
 *
 * LAYOUT (top-to-bottom, spring-staggered in): KPI tiles → verdict donut + rule-firing breakdown →
 * the decisions table → two labelled "Phase 2.2" placeholders (branch×week heatmap + weekly trend, which
 * need seeded multi-branch/multi-week history Phase 1 can't honestly provide). A row opens the
 * {@link ../compliance/RecordModal}.
 *
 * WHERE IT FITS: rendered by {@link ../App} when a ROLE_COMPLIANCE session is active. Content surfaces are
 * opaque (§3a keeps glass to chrome — the shell + the modal overlay); charts are Nivo, themed to our tokens.
 */
import { useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AppShell } from "../components/AppShell";
import type { NavHandlers } from "../components/AppShell";
import { RefreshIcon } from "../components/icons";
import { springGentle } from "../motion";
import { useComplianceDashboard } from "../compliance/useComplianceDashboard";
import type { ComplianceMetrics } from "../compliance/compliance-metrics";
import { VerdictDonut } from "../compliance/VerdictDonut";
import { RuleBreakdownChart } from "../compliance/RuleBreakdownChart";
import { RecordsTable } from "../compliance/RecordsTable";
import { RecordModal } from "../compliance/RecordModal";

/** The compliance dashboard screen. */
export function ComplianceDashboard({ nav }: { nav?: NavHandlers }) {
  const { state, reload } = useComplianceDashboard();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <AppShell title="Compliance Dashboard" nav={nav}>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        {state.status === "loading" && (
          <div className="flex h-64 items-center justify-center text-sm text-muted">
            Loading the decision ledger…
          </div>
        )}

        {state.status === "error" && (
          <div className="mx-auto max-w-md rounded-xl border border-danger-bright/25 bg-danger-tint px-5 py-4">
            <p className="text-[13px] text-danger-bright">{state.message}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:brightness-110"
            >
              <RefreshIcon className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}

        {state.status === "ready" && (
          <DashboardBody metrics={state.metrics} onReload={reload} onSelect={setSelectedId} selectedId={selectedId} />
        )}
      </div>

      {/* Drill-down modal — frosted-glass popup over the dashboard; re-fetches when the selected row changes.
          onReviewed reloads the ledger so the table's reviewed chip updates after a supervisor review. */}
      <AnimatePresence>
        {selectedId !== null && (
          <RecordModal
            recordId={selectedId}
            onClose={() => setSelectedId(null)}
            onReviewed={reload}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

/** The populated dashboard — split out so the ready branch stays declarative. */
function DashboardBody({
  metrics,
  onReload,
  onSelect,
  selectedId,
}: {
  metrics: ComplianceMetrics;
  onReload: () => void;
  onSelect: (recordId: string) => void;
  selectedId: string | null;
}) {
  const reduceMotion = useReducedMotion();
  const { verdict, rules, rows } = metrics;
  const newestCert = rows[0]?.certificateNumber;

  const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
  const section = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: springGentle },
  };

  return (
    <motion.div initial="hidden" animate="show" variants={container} className="flex flex-col gap-6">
      {/* Sub-header: summary line + refresh */}
      <motion.div variants={section} className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          <span className="font-semibold text-ink tabular-nums">{verdict.total}</span> decisions in the ledger
          {newestCert && (
            <>
              {" · newest "}
              <span className="font-mono text-ink">{newestCert}</span>
            </>
          )}
        </p>
        <button
          type="button"
          onClick={onReload}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2"
        >
          <RefreshIcon className="h-4 w-4 text-muted" />
          Refresh
        </button>
      </motion.div>

      {/* KPI tiles */}
      <motion.div variants={section} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total decisions" value={String(verdict.total)} />
        <StatTile label="Flagged" value={String(verdict.flagged)} accent="text-danger-bright" />
        <StatTile label="Passed" value={String(verdict.passed)} accent="text-primary-bright" />
        <StatTile label="Flag rate" value={`${verdict.flagRatePct}%`} />
      </motion.div>

      {/* Charts */}
      <motion.div variants={section} className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Verdict split">
          <VerdictDonut passed={verdict.passed} flagged={verdict.flagged} flagRatePct={verdict.flagRatePct} />
        </ChartCard>
        <ChartCard title="Rule-firing breakdown">
          <RuleBreakdownChart rules={rules} />
        </ChartCard>
      </motion.div>

      {/* Records table */}
      <motion.div variants={section}>
        <RecordsTable rows={rows} selectedId={selectedId} onSelect={onSelect} />
      </motion.div>

      {/* Phase-2.2 placeholders — layout complete, roadmap visible (needs seeded history) */}
      <motion.div variants={section} className="grid gap-4 lg:grid-cols-2">
        <PlaceholderTile
          title="Branch × week heatmap"
          description="Flag density by branch and week — lands with seeded multi-branch history."
          ghost="heatmap"
        />
        <PlaceholderTile
          title="Verdict trend"
          description="Flag rate over time — lands with seeded multi-week history."
          ghost="trend"
        />
      </motion.div>
    </motion.div>
  );
}

/** One KPI tile — mono tabular numeral over a tiny uppercase label (matches VerdictCard's KpiStat). */
function StatTile({ label, value, accent = "text-ink" }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3.5">
      <div className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{label}</div>
      <div className={`mt-1.5 font-mono text-[26px] leading-none font-semibold tabular-nums ${accent}`}>
        {value}
      </div>
    </div>
  );
}

/** A titled opaque content card wrapping a chart (glass is chrome-only, §3a). */
function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-ink">{title}</h3>
      {children}
    </div>
  );
}

/** A labelled "Phase 2.2" placeholder with a faint ghost of the coming visual (honesty §2.6). */
function PlaceholderTile({
  title,
  description,
  ghost,
}: {
  title: string;
  description: string;
  ghost: "heatmap" | "trend";
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-surface px-5 py-5">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <span className="rounded-full bg-primary-tint px-2 py-0.5 text-[10px] font-semibold text-primary-bright">
          Phase 2.2
        </span>
      </div>
      <p className="mt-1.5 max-w-prose text-[12px] text-muted">{description}</p>
      <div className="mt-4 opacity-25">{ghost === "heatmap" ? <HeatmapGhost /> : <TrendGhost />}</div>
    </div>
  );
}

/** Faint grid hinting the coming branch×week heatmap. */
function HeatmapGhost() {
  return (
    <div className="grid grid-cols-8 gap-1.5" aria-hidden="true">
      {Array.from({ length: 32 }, (_, i) => (
        <div
          key={i}
          className="aspect-square rounded-sm bg-primary-bright"
          style={{ opacity: 0.15 + ((i * 7) % 10) / 14 }}
        />
      ))}
    </div>
  );
}

/** Faint area line hinting the coming verdict trend. */
function TrendGhost() {
  return (
    <svg viewBox="0 0 200 60" className="h-16 w-full" aria-hidden="true" preserveAspectRatio="none">
      <polyline
        points="0,45 30,38 60,42 90,28 120,32 150,18 180,24 200,12"
        fill="none"
        stroke="var(--color-primary-bright)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
