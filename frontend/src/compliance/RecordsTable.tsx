/**
 * The decisions table — every decision in the ledger, filterable by verdict + searchable, each row a
 * drill-down into the full record.
 *
 * WHY IT MATTERS: the charts summarise; this makes the underlying audit records reachable. A supervisor
 * filters to FLAGGED, finds a certificate, and opens it — the table is the index into the ledger the
 * compliance role already has read access to (CLAUDE.md §6).
 *
 * A plain semantic {@code <table>} (not a chart) in a scroll container with a sticky header; rows are
 * keyboard-activatable (Enter/Space) and report their selection up via {@link RecordsTableProps.onSelect}.
 *
 * WHERE IT FITS: a card in {@link ../screens/ComplianceDashboard}, fed {@link ./compliance-metrics}
 * `RecordRow[]`; its `onSelect` opens {@link ./RecordModal}. Also reused by the Compliance Copilot's
 * "Proposal Sources" popup ({@link ../screens/ComplianceCopilot}), which passes a pre-filtered subset with
 * `showControls={false}` (the query already IS the filter — an in-table verdict/search header would be
 * redundant there) and a custom `title`. Both extras are optional and default to the dashboard's behaviour,
 * so the dashboard call site is unchanged.
 */
import { useMemo, useState } from "react";

import { formatDateTime, formatInr, humanizeLabel } from "../format";
import { FlagIcon, SearchIcon, ShieldCheckIcon } from "../components/icons";
import type { RecordRow } from "./compliance-metrics";
import type { OverrideStatus, Verdict } from "../api/types";

/** The verdict filter — All, or one verdict. */
type VerdictFilter = "ALL" | Verdict;

/** Props for {@link RecordsTable}. */
interface RecordsTableProps {
  readonly rows: readonly RecordRow[];
  /** The currently open record (row highlight), or null. */
  readonly selectedId: string | null;
  /** Open a record's drill-down drawer. */
  readonly onSelect: (recordId: string) => void;
  /** Header title; defaults to the dashboard's "Decisions". */
  readonly title?: string;
  /** Show the verdict-filter + search controls; defaults to true (dashboard). The copilot popup sets false. */
  readonly showControls?: boolean;
}

/** The segmented verdict filters, in display order. */
const FILTERS: readonly { key: VerdictFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "FLAGGED", label: "Flagged" },
  { key: "PASS", label: "Pass" },
];

/** Filterable, searchable, drill-downable table of every decision. */
export function RecordsTable({
  rows,
  selectedId,
  onSelect,
  title = "Decisions",
  showControls = true,
}: RecordsTableProps) {
  const [filter, setFilter] = useState<VerdictFilter>("ALL");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "ALL" && r.verdict !== filter) {
        return false;
      }
      if (q === "") {
        return true;
      }
      return (
        r.certificateNumber.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.schemeName.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query]);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      {/* Header: title + count, plus (dashboard only) the segmented verdict filter + search */}
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted tabular-nums">
            {visible.length}
          </span>
        </div>

        {showControls && (
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {/* Segmented verdict filter */}
            <div className="flex rounded-lg bg-surface-2 p-0.5" role="group" aria-label="Filter by verdict">
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={filter === key}
                  onClick={() => setFilter(key)}
                  className={`rounded-md px-3 py-1 text-[12px] font-medium transition-colors ${
                    filter === key ? "bg-primary text-white shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="field-inset flex items-center gap-2 rounded-lg px-2.5 py-1.5">
              <SearchIcon className="h-4 w-4 shrink-0 text-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search cert, customer, scheme…"
                aria-label="Search decisions"
                className="w-44 bg-transparent text-[13px] text-ink placeholder:text-muted focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="max-h-[26rem] overflow-y-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-2 text-[11px] tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Certificate</th>
              <th className="px-4 py-2.5 font-semibold">Customer</th>
              <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Scheme</th>
              <th className="px-4 py-2.5 font-semibold">Verdict</th>
              <th className="px-4 py-2.5 text-right font-semibold">Amount</th>
              <th className="hidden px-4 py-2.5 text-right font-semibold md:table-cell">When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted">
                  No decisions match this filter.
                </td>
              </tr>
            ) : (
              visible.map((r) => {
                const selected = r.recordId === selectedId;
                return (
                  <tr
                    key={r.recordId}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open decision ${r.certificateNumber}`}
                    onClick={() => onSelect(r.recordId)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(r.recordId);
                      }
                    }}
                    className={`cursor-pointer transition-colors focus:outline-none focus-visible:bg-surface-2 ${
                      selected ? "bg-primary-tint" : "hover:bg-surface-2"
                    }`}
                  >
                    <td className="px-4 py-2.5 font-mono text-[12px] whitespace-nowrap text-ink tabular-nums">
                      {r.certificateNumber}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap text-ink">{r.customerName}</td>
                    <td className="hidden px-4 py-2.5 whitespace-nowrap text-muted sm:table-cell">
                      {r.schemeName}
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-col items-start gap-1">
                        <VerdictPill verdict={r.verdict} failedRuleCount={r.failedRuleCount} />
                        {r.reviewStatus ? <ReviewChip status={r.reviewStatus} /> : <PendingChip />}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono whitespace-nowrap text-ink tabular-nums">
                      {formatInr(r.amountInr)}
                      <span className="ml-1 text-[10px] font-sans text-muted">
                        {humanizeLabel(r.transactionType)}
                      </span>
                    </td>
                    <td className="hidden px-4 py-2.5 text-right whitespace-nowrap text-muted md:table-cell">
                      {formatDateTime(r.createdAt)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Small tinted verdict pill — teal PASS / red FLAGGED (locked colour semantics), with a fail count. */
function VerdictPill({ verdict, failedRuleCount }: { verdict: Verdict; failedRuleCount: number }) {
  if (verdict === "PASS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-semibold text-primary-bright">
        <ShieldCheckIcon className="h-3.5 w-3.5" />
        Pass
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger-tint px-2 py-0.5 text-[11px] font-semibold text-danger-bright">
      <FlagIcon className="h-3.5 w-3.5" />
      Flagged
      {failedRuleCount > 0 && <span className="font-mono tabular-nums">· {failedRuleCount}</span>}
    </span>
  );
}

/** A small chip marking a decision's human outcome — teal "Approved" or red "Rejected" (brief §6.1). */
function ReviewChip({ status }: { status: OverrideStatus }) {
  const approved = status === "APPROVED";
  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        approved ? "bg-primary-tint text-primary-bright" : "bg-danger-tint text-danger-bright"
      }`}
    >
      {approved ? "Approved" : "Rejected"}
    </span>
  );
}

/** A small chip marking a decision as still awaiting its mandatory human approval. */
function PendingChip() {
  return (
    <span className="inline-flex items-center rounded-full bg-accent-tint px-1.5 py-0.5 text-[10px] font-medium text-accent-bright">
      Pending
    </span>
  );
}
