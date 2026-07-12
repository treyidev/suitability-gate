/**
 * The ROLE_RM "Prospects" co-pilot — a deterministic advisory worklist (brief §14; owner directive
 * 2026-07-12). Every customer for whom some plan CLEARS the suitability gate is a card: the customer, the
 * suggested plan, and whether they are already an established client. The RM searches/filters, clicks a
 * card, and the Evaluate workbench opens pre-filled — the RM still Evaluates + Submits through the gate, so
 * this is discovery, never advice and never a verdict (thesis: AI proposes · human accepts · code decides ·
 * human approves). The plan on each card is produced by the same deterministic proposer as the in-form
 * "Suggest a plan", so the co-pilot can never surface a product its own gate would flag.
 *
 * WHERE IT FITS: the RM-side mirror of what the Ledger Copilot is for compliance — browse across customers
 * FIRST, then act on one. It sits beside the workbench in {@link ../App}'s RmWorkspace and hands a prefill
 * into it; data comes from {@link ../prospects/useProspects} (RM-only GET /prospects, race-safe).
 *
 * ORANGE = ALREADY SERVED (owner request): an established client (≥1 decision on record) glows orange via
 * {@link ../theme.css .glow-served} — a HIGHLIGHT, not a failure, so it uses the accent/orange family, never
 * red (the 2026-07-11 colour re-architecture reserves red for failures). Fresh prospects stay neutral/teal.
 *
 * "GOES AWAY" ON SUBMIT: the workspace tracks customers the RM has submitted this session ({@link
 * RmProspectsProps.dismissed}); their card is filtered out here, so a handled prospect disappears from the
 * worklist. Search + filter are pure client-side over the loaded rows (already fresh-first from the server).
 */
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import type { Prospect } from "../api/types";
import { AppShell } from "../components/AppShell";
import type { NavHandlers } from "../components/AppShell";
import { ArrowRightIcon, RefreshIcon, SearchIcon, SparkIcon, UserIcon } from "../components/icons";
import { formatInr, formatMonths, humanizeLabel, TRANSACTION_TYPE_LABELS } from "../format";
import { springGentle } from "../motion";
import { useProspects } from "../prospects/useProspects";

/** The client-side filter over the worklist — the owner's "deterministic search/filter", by served state. */
type ProspectFilter = "all" | "fresh" | "served";

/** Filter segments, in display order. */
const FILTERS: readonly { readonly key: ProspectFilter; readonly label: string }[] = [
  { key: "all", label: "All" },
  { key: "fresh", label: "Fresh" },
  { key: "served", label: "Existing clients" },
];

/** Props for {@link RmProspects}. */
interface RmProspectsProps {
  /** In-app nav rail handlers (Evaluate ↔ Prospects). */
  readonly nav: NavHandlers;
  /** Customers the RM already submitted this session — filtered out (their card "goes away"). */
  readonly dismissed: ReadonlySet<string>;
  /** Called when the RM picks a card — the workspace pre-fills the workbench with it. */
  readonly onSelect: (prospect: Prospect) => void;
}

/** The RM Prospects worklist screen. */
export function RmProspects({ nav, dismissed, onSelect }: RmProspectsProps) {
  const { state, reload } = useProspects();

  return (
    <AppShell title="Prospects" nav={nav}>
      <div className="mx-auto max-w-4xl px-6 py-8 sm:px-8">
        {state.status === "loading" && (
          <div className="flex h-64 items-center justify-center text-sm text-muted">
            Loading the prospect worklist…
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
          <ProspectsBody prospects={state.prospects} dismissed={dismissed} onSelect={onSelect} />
        )}
      </div>
    </AppShell>
  );
}

/** The interactive body — mounted only once the worklist is loaded, so `prospects` is always present. */
function ProspectsBody({
  prospects,
  dismissed,
  onSelect,
}: {
  prospects: readonly Prospect[];
  dismissed: ReadonlySet<string>;
  onSelect: (prospect: Prospect) => void;
}) {
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProspectFilter>("all");

  // Pure client-side search + filter over the already-fresh-first rows; a dismissed (submitted-this-session)
  // customer is dropped entirely, so a handled prospect "goes away" regardless of the active filter.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return prospects.filter((prospect) => {
      if (dismissed.has(prospect.customer.customerId)) return false;
      if (filter === "fresh" && prospect.alreadyServed) return false;
      if (filter === "served" && !prospect.alreadyServed) return false;
      if (q !== "" && !prospect.customer.fullName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [prospects, dismissed, query, filter]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header + honest sublabel */}
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-tint text-primary-bright">
            <SearchIcon className="h-5 w-5" />
          </span>
          <h2 className="text-xl font-semibold text-ink">Find a suitable plan</h2>
        </div>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted">
          A deterministic worklist: every customer shown has a plan that already clears the suitability
          gate. Pick one to open the Evaluate form pre-filled — the gate still decides on Submit. Nothing
          here is advice.
        </p>
      </div>

      {/* Search + served-state filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="field-inset flex items-center gap-2 rounded-xl px-3 py-2 sm:w-64">
          <SearchIcon className="h-4.5 w-4.5 shrink-0 text-muted" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customers…"
            aria-label="Search customers by name"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-muted focus:outline-none"
          />
        </div>

        <div role="tablist" aria-label="Filter prospects" className="field-inset flex gap-1 rounded-lg p-1">
          {FILTERS.map(({ key, label }) => {
            const selected = filter === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => setFilter(key)}
                className="relative z-10 rounded-md px-3 py-1.5 text-[12px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary-bright/40"
              >
                {selected &&
                  (reduceMotion ? (
                    <span className="absolute inset-0 -z-10 rounded-md border border-primary-bright/40 bg-primary-tint" />
                  ) : (
                    <motion.span
                      layoutId="prospectfilter"
                      transition={springGentle}
                      className="absolute inset-0 -z-10 rounded-md border border-primary-bright/40 bg-primary-tint"
                    />
                  ))}
                <span className={selected ? "text-primary-bright" : "text-muted"}>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* The worklist — or an empty state when search/filter/dismissal leaves nothing */}
      {visible.length === 0 ? (
        <EmptyProspects />
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((prospect) => (
            <ProspectCard
              key={prospect.customer.customerId}
              prospect={prospect}
              onSelect={() => onSelect(prospect)}
              reduceMotion={reduceMotion ?? false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One worklist card — the customer, the gate-passing suggested plan, and (for an established client) the
 * orange "Existing client" glow. The whole card is one button: clicking it hands the prospect up to be
 * pre-filled into the Evaluate workbench.
 */
function ProspectCard({
  prospect,
  onSelect,
  reduceMotion,
}: {
  prospect: Prospect;
  onSelect: () => void;
  reduceMotion: boolean;
}) {
  const { customer, plan, alreadyServed } = prospect;
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileTap={reduceMotion ? undefined : { scale: 0.995 }}
      aria-label={`Evaluate ${customer.fullName} with ${plan.schemeName}`}
      className={`group w-full rounded-xl border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary-bright/50 focus-visible:outline-none ${
        alreadyServed
          ? "glow-served bg-accent-tint/50 hover:brightness-110"
          : "border-line bg-surface hover:border-primary-bright/40"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <UserIcon className={`h-4 w-4 shrink-0 ${alreadyServed ? "text-accent-bright" : "text-muted"}`} />
            <span className="truncate text-[15px] font-semibold text-ink">{customer.fullName}</span>
            {alreadyServed && (
              <span className="rounded-full border border-accent/40 bg-accent-tint px-2 py-0.5 text-[10px] font-semibold tracking-wide text-accent-bright uppercase">
                Existing client
              </span>
            )}
          </div>
          <div className="mt-1 text-[12px] text-muted">
            {customer.ageYears}y · {humanizeLabel(customer.riskCategory)} · horizon{" "}
            {formatMonths(customer.investmentHorizonMonths)}
          </div>
        </div>
        <span className="mt-0.5 flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary-bright opacity-0 transition-opacity group-hover:opacity-100">
          Evaluate
          <ArrowRightIcon className="h-4 w-4" />
        </span>
      </div>

      {/* The suggested, gate-passing plan */}
      <div className="mt-3 rounded-lg border border-line bg-surface-2 p-3">
        <div className="flex items-center gap-1.5 text-primary-bright">
          <SparkIcon className="h-3.5 w-3.5" />
          <span className="text-[10px] font-semibold tracking-[0.12em] uppercase">Suggested plan</span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-[14px] font-medium text-ink">{plan.schemeName}</span>
          <span className="font-mono text-[13px] text-ink tabular-nums">
            {formatInr(plan.amountInr)} · {TRANSACTION_TYPE_LABELS[plan.transactionType]}
          </span>
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{plan.rationale}</p>
      </div>
    </motion.button>
  );
}

/** Shown when the search/filter (or session dismissals) leaves no visible prospects. */
function EmptyProspects() {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <SearchIcon className="h-9 w-9 text-line" />
      <p className="mt-3 text-sm font-medium text-ink">No matching prospects</p>
      <p className="mt-1 max-w-xs text-[13px] text-muted">
        Clear the search or switch the filter — or every prospect here has already been actioned this
        session.
      </p>
    </div>
  );
}
