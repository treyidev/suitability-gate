/**
 * The Compliance Copilot — a supervisor-only natural-language query interface over the decision ledger,
 * with ZERO model in the loop. This is the thesis at its purest: the supervisor types a question, a
 * deterministic parser ({@link ../copilot/queryEngine}) extracts a typed filter, code filters the
 * already-loaded records, and a template answer renders with REAL counts. Nothing is generated — the
 * engine retrieves and counts, and the understood-filter chips SHOW the interpretation so the number is
 * always auditable. A live conversational model is the Phase-2 seam and would still be strictly downstream
 * of these counts (prose only, never a number).
 *
 * LAYOUT (top-to-bottom): header ("Ask the ledger") + an honest sublabel · the ask bar (input + send) with
 * example-query chips that steer to queries that work · then the turns, NEWEST-FIRST directly under the bar.
 * Newest-first (not the usual chat oldest-first-with-bottom-input) is a deliberate choice: each query is
 * STANDALONE — there is NO conversation memory (a filter is derived from one query string alone) — so the
 * most relevant answer belongs right under the input where it needs no scrolling, and a sticky footer's
 * fragile height math is avoided. Each turn is a query bubble + an answer bubble; an answer bubble carries
 * the composed text, the interpretation chips, and a "Proposal Sources (N)" button when N > 0.
 *
 * DRILL PATH (reused, not rebuilt): "Proposal Sources" opens a frosted popup listing the matches in the
 * dashboard's {@link ../compliance/RecordsTable} (fed a filtered subset via
 * {@link ../compliance/compliance-metrics.recordsToRows}, controls hidden), and a row opens the dashboard's
 * {@link ../compliance/RecordModal} — the same full audit drill-down (staff audience).
 *
 * WHERE IT FITS: rendered by {@link ../App}'s ComplianceWorkspace when a ROLE_COMPLIANCE session picks the
 * "Copilot" rail item; data comes from {@link ../copilot/useLedgerRecords} (the whole-ledger read, race-safe).
 */
import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { AppShell } from "../components/AppShell";
import type { NavHandlers } from "../components/AppShell";
import { ArrowRightIcon, ChatIcon, CloseIcon, LedgerRowsIcon, RefreshIcon } from "../components/icons";
import { springGentle } from "../motion";
import { recordsToRows } from "../compliance/compliance-metrics";
import { RecordsTable } from "../compliance/RecordsTable";
import { RecordModal } from "../compliance/RecordModal";
import { useLedgerRecords } from "../copilot/useLedgerRecords";
import { buildCatalog, runLedgerQuery } from "../copilot/queryEngine";
import type { LedgerCatalog, LedgerQueryResult } from "../copilot/queryEngine";
import type { DecisionRecord } from "../api/types";

/**
 * Curated example queries — every one exercises the parser's vocabulary and returns a non-empty result on
 * the seeded ledger, so a judge who clicks a chip always sees the engine work (not a hollow "no matches").
 */
const EXAMPLE_QUERIES: readonly string[] = [
  "Flagged proposals for senior citizens",
  "Pending approvals this week",
  "Proposals for Sunita Sharma",
  "Small cap schemes that passed",
];

/** The dimensions the deterministic engine can filter on — shown on the capability card. */
const CAPABILITIES: readonly string[] = [
  "Verdict — flagged or passed",
  "Approval — awaiting review, approved, or rejected",
  "Customer — senior citizens, a risk profile, or a named customer",
  "Scheme — small cap, large cap, ELSS, balanced, liquid, debt",
  "Time — today or this week",
];

/** One entry in the query log — a standalone query and its computed result (no cross-turn memory). */
interface Turn {
  readonly id: number;
  readonly query: string;
  readonly result: LedgerQueryResult;
}

/** The Compliance Copilot screen. */
export function ComplianceCopilot({ nav }: { nav: NavHandlers }) {
  const { state, reload } = useLedgerRecords();

  return (
    <AppShell title="Ledger Copilot" nav={nav}>
      <div className="mx-auto max-w-3xl px-5 py-8 sm:px-8">
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

        {state.status === "ready" && <CopilotBody records={state.records} onReviewed={reload} />}
      </div>
    </AppShell>
  );
}

/** The interactive body — mounted only once the ledger is loaded, so `records` is always present. */
function CopilotBody({
  records,
  onReviewed,
}: {
  records: readonly DecisionRecord[];
  onReviewed: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const catalog: LedgerCatalog = useMemo(() => buildCatalog(records), [records]);

  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<readonly Turn[]>([]);
  // The turn whose "Proposal Sources" popup is open, or null. A turn id (not the matches) so the popup
  // always reflects that turn's frozen result.
  const [sourcesTurnId, setSourcesTurnId] = useState<number | null>(null);
  // The record open in the drill-down modal, or null.
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const nextIdRef = useRef(0);

  /** Run a query and prepend the turn (newest-first). Empty/whitespace is a no-op. */
  function submit(rawQuery: string): void {
    const query = rawQuery.trim();
    if (query === "") {
      return;
    }
    const result = runLedgerQuery(query, records, catalog);
    const turn: Turn = { id: nextIdRef.current++, query, result };
    setTurns((prev) => [turn, ...prev]);
    setInput("");
  }

  const openSourcesTurn = sourcesTurnId === null ? null : turns.find((t) => t.id === sourcesTurnId) ?? null;
  const sourceMatches: readonly DecisionRecord[] =
    openSourcesTurn && openSourcesTurn.result.kind === "answer" ? openSourcesTurn.result.matches : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Header + honest sublabel */}
      <div>
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-tint text-primary-bright">
            <ChatIcon className="h-5 w-5" />
          </span>
          <h2 className="text-xl font-semibold text-ink">Ask the ledger</h2>
        </div>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-muted">
          Deterministic query engine over the decision ledger — every number is computed, nothing is
          generated. Each question stands alone (no conversation memory). Conversational model lands in
          Phase 2.
        </p>
      </div>

      {/* Ask bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="flex flex-col gap-3"
      >
        <div className="field-inset flex items-center gap-2 rounded-xl px-3 py-2">
          <ChatIcon className="h-4.5 w-4.5 shrink-0 text-muted" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. flagged proposals for senior citizens"
            aria-label="Ask the ledger a question"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-muted focus:outline-none"
          />
          <motion.button
            type="submit"
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            className="btn-primary-fill flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13px] font-semibold text-white transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary-bright/60 focus-visible:outline-none"
          >
            Ask
            <ArrowRightIcon className="h-4 w-4" />
          </motion.button>
        </div>

        {/* Example chips — steer to queries that work */}
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_QUERIES.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => submit(q)}
              className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:border-primary-bright/40 hover:text-ink"
            >
              {q}
            </button>
          ))}
        </div>
      </form>

      {/* Turns (newest-first) — or the capability card when nothing has been asked yet */}
      {turns.length === 0 ? (
        <CapabilityCard onExample={submit} />
      ) : (
        <div className="flex flex-col gap-5">
          <AnimatePresence initial={false}>
            {turns.map((turn) => (
              <motion.div
                key={turn.id}
                layout={!reduceMotion}
                initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springGentle}
              >
                <TurnView
                  turn={turn}
                  onOpenSources={() => setSourcesTurnId(turn.id)}
                  onExample={submit}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Proposal Sources popup — frosted overlay listing the turn's matches in the dashboard table */}
      <AnimatePresence>
        {openSourcesTurn !== null && sourceMatches.length > 0 && (
          <SourcesPopup
            matches={sourceMatches}
            selectedId={selectedRecordId}
            onSelect={setSelectedRecordId}
            onClose={() => setSourcesTurnId(null)}
          />
        )}
      </AnimatePresence>

      {/* Drill-down modal — the SAME record modal the dashboard uses; rendered last so it stacks above the
          sources popup. A recorded review reloads the ledger for future queries. */}
      <AnimatePresence>
        {selectedRecordId !== null && (
          <RecordModal
            recordId={selectedRecordId}
            onClose={() => setSelectedRecordId(null)}
            onReviewed={onReviewed}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** One query + its answer (or capability fallback for an unparseable query). */
function TurnView({
  turn,
  onOpenSources,
  onExample,
}: {
  turn: Turn;
  onOpenSources: () => void;
  onExample: (query: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Query bubble — right-aligned, teal-tinted (the supervisor's ask) */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary-tint px-3.5 py-2 text-[13px] text-ink">
          {turn.query}
        </div>
      </div>

      {/* Answer bubble — left-aligned surface */}
      <div className="flex justify-start">
        <div className="max-w-[92%] rounded-2xl rounded-bl-sm border border-line bg-surface px-4 py-3">
          {turn.result.kind === "capability" ? (
            <CapabilityCard onExample={onExample} embedded />
          ) : (
            <AnswerView result={turn.result} onOpenSources={onOpenSources} />
          )}
        </div>
      </div>
    </div>
  );
}

/** The computed answer: interpretation chips + the real-number text + a Sources button when N > 0. */
function AnswerView({
  result,
  onOpenSources,
}: {
  result: Extract<LedgerQueryResult, { kind: "answer" }>;
  onOpenSources: () => void;
}) {
  const matchCount = result.matches.length;
  return (
    <div className="flex flex-col gap-3">
      {/* Understood-filter chips — the honesty device: shows exactly what was parsed */}
      {result.chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Understood</span>
          {result.chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink"
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      <p className="text-[13.5px] leading-relaxed text-ink">{result.answer}</p>

      {matchCount > 0 && (
        <button
          type="button"
          onClick={onOpenSources}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-semibold text-ink transition-colors hover:border-primary-bright/40 hover:text-primary-bright"
        >
          <LedgerRowsIcon className="h-4 w-4 text-muted" />
          Proposal Sources ({matchCount})
        </button>
      )}
    </div>
  );
}

/**
 * The capability card — what the copilot CAN answer + clickable example queries. Rendered as the fresh-screen
 * empty state AND as the honest fallback when a query matched no vocabulary (embedded in an answer bubble).
 */
function CapabilityCard({
  onExample,
  embedded = false,
}: {
  onExample: (query: string) => void;
  embedded?: boolean;
}) {
  return (
    <div className={embedded ? "" : "rounded-xl border border-dashed border-line bg-surface px-5 py-5"}>
      <p className="text-[13px] font-medium text-ink">
        {embedded
          ? "I couldn't map that to the ledger. I retrieve and count — I don't generate — so here's what I can answer:"
          : "Ask about the decision ledger. I retrieve and count records — I can filter by:"}
      </p>
      <ul className="mt-3 flex flex-col gap-1.5">
        {CAPABILITIES.map((cap) => (
          <li key={cap} className="flex items-start gap-2 text-[12.5px] text-muted">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary-bright" />
            {cap}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">Try</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onExample(q)}
            className="rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-muted transition-colors hover:border-primary-bright/40 hover:text-ink"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * The "Proposal Sources" popup — a frosted overlay over the copilot, listing the matched proposals in the
 * dashboard's own {@link RecordsTable} (controls hidden — the query already IS the filter). A row opens the
 * shared {@link RecordModal}. Dialog semantics mirror the record modal (Escape/backdrop close via the same
 * pattern; here a plain close button + backdrop click keep it lean).
 */
function SourcesPopup({
  matches,
  selectedId,
  onSelect,
  onClose,
}: {
  matches: readonly DecisionRecord[];
  selectedId: string | null;
  onSelect: (recordId: string) => void;
  onClose: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const rows = useMemo(() => recordsToRows(matches), [matches]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Frosted backdrop — blurs the copilot behind (a sanctioned glass overlay, §3a) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-canvas/45 backdrop-blur-md"
        aria-hidden="true"
      />

      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label="Matching proposals"
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
        transition={springGentle}
        className="relative z-10 flex max-h-[88vh] w-full max-w-3xl flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">
            Proposal sources
            <span className="ml-2 font-mono text-muted tabular-nums">{matches.length}</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2/90 text-ink ring-1 ring-line backdrop-blur transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary-bright/60 focus-visible:outline-none"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Opaque content on the frosted backdrop (no glass-on-glass, §1b). The dashboard's exact table. */}
        <div className="min-h-0 overflow-y-auto">
          <RecordsTable
            rows={rows}
            selectedId={selectedId}
            onSelect={onSelect}
            title="Matching proposals"
            showControls={false}
          />
        </div>
      </motion.aside>
    </div>
  );
}
