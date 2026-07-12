/**
 * The compliance dashboard's aggregation layer — pure functions that fold the raw decision ledger into
 * the metrics the widgets render.
 *
 * WHY THIS EXISTS (the extendability seam): the dashboard is deliberately built "rich frontend, least
 * backend" (owner decision 2026-07-11). The backend ships the whole ledger as-is via {@code GET /records};
 * ALL aggregation happens here, in one pure, side-effect-free function. That makes this module the literal
 * specification of what a future server-side {@code GET /dashboard/*} endpoint would compute — so Phase 2.2
 * can move aggregation onto the server (returning {@link ComplianceMetrics} directly) and the hook + every
 * widget stay byte-for-byte unchanged. The swap point is {@link useComplianceDashboard}; this is its contract.
 *
 * WHERE IT FITS: {@code fetchRecords} (api/client) → {@link deriveComplianceMetrics} → the
 * {@code useComplianceDashboard} hook → the ComplianceDashboard screen's widgets.
 *
 * LIMITATIONS (with mitigations):
 *  - Reads only what a {@link DecisionRecord} carries. The branch×week heatmap and weekly trend are NOT
 *    derived here — they need seeded multi-branch / multi-week history that Phase 1 (one RM / one branch,
 *    time-clustered) cannot honestly provide. That is the tracked "Phase 2.2" work; until then the screen
 *    renders those two as labeled placeholders. Everything derived here IS honest against real records.
 *  - No explanation state is read: the {@code GET /records} list omits it by design (see api/client
 *    {@code fetchRecords}). Drill-down (fetchRecord) carries the real prose.
 *
 * SAFE EXTENSIONS: add a new metric by adding a field to {@link ComplianceMetrics} and computing it in
 * {@link deriveComplianceMetrics} from the same records — no backend change. When Phase 2.2 adds the
 * heatmap/trend, extend the returned shape here (or have the server return it) behind the same seam.
 * REGRESSIONS TO AVOID: do NOT fetch, branch on env, or reach for {@code Date.now()} here — keeping this a
 * pure fold of its input is what lets it double as the server-endpoint spec and stay trivially testable.
 * Do NOT read {@code aiContribution} from the list records (it is always PENDING here — see above).
 */
import type { DecisionRecord, OverrideStatus, TransactionType, Verdict } from "../api/types";

/** Headline verdict counts across the whole ledger. */
export interface VerdictBreakdown {
  /** Total decisions in the ledger. */
  readonly total: number;
  /** Decisions whose composed verdict was FLAGGED. */
  readonly flagged: number;
  /** Decisions whose composed verdict was PASS. */
  readonly passed: number;
  /** Flagged as a percentage of total, one decimal place; 0 when the ledger is empty. */
  readonly flagRatePct: number;
}

/**
 * How one rule behaved across the whole ledger — the "rule-firing breakdown" widget's row. Rules appear
 * in canonical (engine display) order, taken from first appearance across records.
 */
export interface RuleStat {
  /** Stable rule id, e.g. {@code AGE_RISK_BAND} (the view humanises it for display). */
  readonly ruleId: string;
  /** Records in which this rule produced any result. */
  readonly appearances: number;
  /** Times the rule passed. */
  readonly passed: number;
  /** Times the rule failed (outcome FAIL). */
  readonly failed: number;
  /** Times the rule was skipped (a capability it needed was absent). */
  readonly skipped: number;
  /** Times the rule was a FLAG-severity FAIL that drove the verdict to FLAGGED. */
  readonly blocking: number;
  /** Failures as a percentage of decided (passed+failed) appearances, one decimal; 0 if never decided. */
  readonly failRatePct: number;
}

/** One row of the records table — the flat, display-ready projection of a decision, with drill-down id. */
export interface RecordRow {
  readonly recordId: string;
  readonly certificateNumber: string;
  /** ISO-8601 creation timestamp (the view formats it). */
  readonly createdAt: string;
  readonly customerName: string;
  readonly schemeName: string;
  readonly schemeRiskometer: string;
  readonly verdict: Verdict;
  readonly amountInr: number;
  readonly transactionType: TransactionType;
  readonly branchCode: string;
  /** Count of FAIL rule results — a quick "why" glance for a flagged row. */
  readonly failedRuleCount: number;
  /** The supervisor-review outcome if this decision has been reviewed, else null (brief §6.1). */
  readonly reviewStatus: OverrideStatus | null;
}

/** Everything the dashboard renders, computed from the ledger. The future {@code GET /dashboard/*} shape. */
export interface ComplianceMetrics {
  readonly verdict: VerdictBreakdown;
  /** One entry per rule, in canonical engine order. */
  readonly rules: readonly RuleStat[];
  /** Table rows, newest decision first. */
  readonly rows: readonly RecordRow[];
}

/** Round to one decimal place (percentages), avoiding float noise like {@code 33.33333}. */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Mutable accumulator for a rule's running tallies while folding the ledger. */
interface RuleTally {
  ruleId: string;
  appearances: number;
  passed: number;
  failed: number;
  skipped: number;
  blocking: number;
}

/**
 * Fold the raw decision ledger into the dashboard's metrics. Pure: same input ⇒ same output, no I/O, no
 * clock, no mutation of the input.
 *
 * @param records the whole ledger as returned by {@code GET /records} (any order; rows are re-sorted here)
 * @returns the verdict breakdown, per-rule stats (canonical order), and newest-first table rows
 */
export function deriveComplianceMetrics(records: readonly DecisionRecord[]): ComplianceMetrics {
  const total = records.length;
  let flagged = 0;

  // Insertion-ordered map: first time we see a ruleId fixes its position, which mirrors the engine's
  // @Order display sequence because every record lists its rules in that same canonical order.
  const tallies = new Map<string, RuleTally>();

  for (const record of records) {
    if (record.verdict === "FLAGGED") {
      flagged += 1;
    }
    for (const rule of record.ruleResults) {
      let tally = tallies.get(rule.ruleId);
      if (tally === undefined) {
        tally = { ruleId: rule.ruleId, appearances: 0, passed: 0, failed: 0, skipped: 0, blocking: 0 };
        tallies.set(rule.ruleId, tally);
      }
      tally.appearances += 1;
      if (rule.outcome === "PASS") {
        tally.passed += 1;
      } else if (rule.outcome === "FAIL") {
        tally.failed += 1;
      } else {
        tally.skipped += 1;
      }
      if (rule.blockingFailure) {
        tally.blocking += 1;
      }
    }
  }

  const rules: RuleStat[] = [...tallies.values()].map((t) => {
    const decided = t.passed + t.failed;
    return {
      ruleId: t.ruleId,
      appearances: t.appearances,
      passed: t.passed,
      failed: t.failed,
      skipped: t.skipped,
      blocking: t.blocking,
      failRatePct: decided === 0 ? 0 : round1((t.failed / decided) * 100),
    };
  });

  const rows = recordsToRows(records);

  return {
    verdict: {
      total,
      flagged,
      passed: total - flagged,
      flagRatePct: total === 0 ? 0 : round1((flagged / total) * 100),
    },
    rules,
    rows,
  };
}

/**
 * Project a set of decision records down to the flat, newest-first table rows the {@link ./RecordsTable}
 * renders — the exact projection the dashboard uses, extracted so the Compliance Copilot's "Proposal
 * Sources" popup can feed the SAME table component a filtered subset (identical row rendering, zero drift).
 *
 * Re-sorts defensively so the seam is self-contained (a future server aggregate might not pre-sort);
 * ISO-8601 strings sort lexicographically == chronologically, newest first.
 *
 * @param records any set of decision records (the whole ledger, or a copilot-filtered subset)
 * @returns display-ready rows, newest decision first
 */
export function recordsToRows(records: readonly DecisionRecord[]): RecordRow[] {
  return records
    .map(toRecordRow)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/** Project a single full decision record down to the flat row the table renders. */
function toRecordRow(record: DecisionRecord): RecordRow {
  return {
    recordId: record.recordId,
    certificateNumber: record.certificateNumber,
    createdAt: record.createdAt,
    customerName: record.customerSnapshot.fullName,
    schemeName: record.schemeSnapshot.name,
    schemeRiskometer: record.schemeSnapshot.riskometerLevel,
    verdict: record.verdict,
    amountInr: record.proposal.amountInr,
    transactionType: record.proposal.transactionType,
    branchCode: record.proposal.branchCode,
    failedRuleCount: record.ruleResults.filter((r) => r.outcome === "FAIL").length,
    // Phase-1 is one review per record, so the first (only) override carries the outcome.
    reviewStatus: record.overrides[0]?.resultingStatus ?? null,
  };
}
