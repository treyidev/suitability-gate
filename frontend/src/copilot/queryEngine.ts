/**
 * The Compliance Copilot's deterministic query engine — a pure, LLM-free parser + code-computed answers
 * over the decision ledger.
 *
 * WHY THIS EXISTS: the thesis at its purest ("Guarantees in code, judgment in the model") — here there is
 * NO model at all. A supervisor types natural language; this module extracts a typed {@link LedgerFilter}
 * by keyword/pattern matching, filters the already-loaded records, and composes an answer whose every number
 * is COUNTED, never generated. Nothing is fabricated: the {@link describeFilter} chips SHOW the machine's
 * interpretation so the supervisor can see exactly what was (and was not) understood. A query that matches
 * no vocabulary yields a distinct "capability" result so the UI can honestly say what it CAN answer rather
 * than bluff an answer.
 *
 * WHERE IT FITS: {@code fetchRecords} (api/client) → {@link ../copilot/useLedgerRecords} → the
 * {@link ../screens/ComplianceCopilot} screen calls {@link runLedgerQuery} per submitted query. It reads the
 * SAME {@link DecisionRecord} shape the compliance dashboard folds; the sources popup reuses the dashboard's
 * table via {@link ../compliance/compliance-metrics.recordsToRows}, and a row opens the dashboard's
 * {@link ../compliance/RecordModal}.
 *
 * DESIGN (house debuggability rules): top-level pure functions + immutable data records only — no classes,
 * no closures hiding logic. The vocabulary lives in printable module-level consts so a failing match can be
 * inspected by eye. Each query is standalone: there is NO conversation memory (a filter is derived from one
 * query string alone), which is why the engine is a set of pure folds rather than a stateful session.
 *
 * LIMITATIONS (with mitigations):
 *  - Vocabulary is curated, not a general NLP model — an unrecognised phrasing yields the capability card
 *    (honest "I can answer these"), never a wrong answer. Extend {@link SCHEME_VOCAB} / the parse regexes to
 *    widen coverage; a real conversational model is the Phase-2 seam (it would still be strictly downstream
 *    of these deterministic counts — it renders prose, never a number).
 *  - Explanation state is deliberately NOT read here (the list records carry it as PENDING always — see
 *    api/client {@code fetchRecords}); this engine only reads verdict / snapshots / overrides / createdAt.
 *
 * SAFE EXTENSIONS: add a new recognised dimension by adding a field to {@link LedgerFilter}, a parse branch
 * in {@link parseLedgerQuery}, a match branch in {@link applyLedgerFilter}, and a chip in
 * {@link describeFilter}. REGRESSIONS TO AVOID: do NOT let any function here fabricate a value the records do
 * not contain, and do NOT read the clock outside {@link applyLedgerFilter}'s injected {@code now} — keeping
 * parse/compose pure of time is what makes the whole engine trivially replayable.
 */
import type { DecisionRecord, Verdict } from "../api/types";

/** A record's supervisor-review state — the approval dimension the copilot filters on (brief §6.1). */
export type ApprovalState = "PENDING" | "APPROVED" | "REJECTED";

/** A relative time window the copilot understands. */
export type TimeWindow = "TODAY" | "WEEK";

/**
 * One recognised scheme phrasing, resolved to the substrings that identify it inside a record's scheme text.
 * A group carries multiple {@link terms} because one human phrasing can map to either the scheme NAME or its
 * category token (e.g. "balanced" appears in the fund name, "hybrid" in the category) — a record matches the
 * group if its scheme text contains ANY of the terms.
 */
export interface SchemeGroup {
  /** Human display label for the chip, e.g. {@code "Small cap"}. */
  readonly label: string;
  /** Normalised (upper-case, underscores→spaces) substrings; a record matches if its scheme text has any. */
  readonly terms: readonly string[];
}

/**
 * The typed, immutable interpretation of one query — what the deterministic parser understood. Every field
 * is null / empty when its dimension was not recognised; {@link recognizedDimensionCount} counts the active
 * dimensions (zero ⇒ the query was unparseable and the UI shows the capability card).
 */
export interface LedgerFilter {
  /** Composed verdict to require, or null. */
  readonly verdict: Verdict | null;
  /** Supervisor-review state to require, or null. */
  readonly approval: ApprovalState | null;
  /** True when the query restricted to senior-citizen customers. */
  readonly seniorOnly: boolean;
  /** Customer risk category to require (CONSERVATIVE / MODERATE / AGGRESSIVE), or null. */
  readonly riskCategory: string | null;
  /** Scheme riskometer level to require (e.g. VERY_HIGH), or null — set only for explicit "… risk" phrasing. */
  readonly riskometerLevel: string | null;
  /** Recognised scheme phrasings (OR-combined across groups), possibly empty. */
  readonly schemeGroups: readonly SchemeGroup[];
  /** Full customer names the query named (OR-combined), possibly empty. */
  readonly customerNames: readonly string[];
  /** Relative time window, or null. */
  readonly time: TimeWindow | null;
}

/** The catalogue the parser needs to ground data-driven matches (built from the loaded ledger). */
export interface LedgerCatalog {
  /** Every distinct customer full name present in the ledger — grounds customer-name matching. */
  readonly customerNames: readonly string[];
  /** Every distinct scheme name present in the ledger — grounds direct scheme-name matching. */
  readonly schemeNames: readonly string[];
}

/**
 * The engine's answer to one query — either a computed answer (with the raw matched records for the sources
 * popup) or the capability card when nothing was recognised.
 */
export type LedgerQueryResult =
  | {
      readonly kind: "answer";
      /** What the parser understood (drives the honesty chips). */
      readonly filter: LedgerFilter;
      /** Human-readable chips of the understood interpretation. */
      readonly chips: readonly string[];
      /** The composed, real-number answer text. */
      readonly answer: string;
      /** The matched raw records (newest-first as fed in), for the "Proposal Sources" popup + drill-down. */
      readonly matches: readonly DecisionRecord[];
    }
  | {
      /** Nothing was recognised — the UI renders the capability card, never a fabricated answer. */
      readonly kind: "capability";
    };

/**
 * Curated scheme vocabulary — the stable domain categories a supervisor names, each mapped to the substrings
 * that identify it inside a record's scheme text (name + category, upper-cased, underscores→spaces). This is
 * deliberately a fixed map rather than tokenising scheme names: the category concepts ("small cap", "elss")
 * are stable across deployments, while the noise words in fund names ("IDBI", "Fund", "Advantage") are not
 * worth matching. Direct full-scheme-name matching (via {@link LedgerCatalog.schemeNames}) complements this.
 */
const SCHEME_VOCAB: readonly { readonly keywords: readonly string[]; readonly label: string; readonly terms: readonly string[] }[] = [
  { keywords: ["small cap", "smallcap", "small-cap"], label: "Small cap", terms: ["SMALL CAP"] },
  { keywords: ["large cap", "largecap", "large-cap", "bluechip", "blue chip", "blue-chip"], label: "Large cap", terms: ["LARGE CAP", "BLUECHIP"] },
  { keywords: ["elss", "tax saver", "tax-saver", "tax saving", "tax-saving"], label: "ELSS (tax saver)", terms: ["ELSS"] },
  { keywords: ["balanced", "hybrid", "balanced advantage"], label: "Balanced / Hybrid", terms: ["BALANCED", "HYBRID"] },
  { keywords: ["liquid"], label: "Liquid", terms: ["LIQUID"] },
  { keywords: ["debt", "bond", "short term debt", "short-term debt"], label: "Debt", terms: ["DEBT"] },
] as const;

/** Build the parser's catalogue from the loaded ledger (distinct customer + scheme names). */
export function buildCatalog(records: readonly DecisionRecord[]): LedgerCatalog {
  const customerNames = new Set<string>();
  const schemeNames = new Set<string>();
  for (const record of records) {
    customerNames.add(record.customerSnapshot.fullName);
    schemeNames.add(record.schemeSnapshot.name);
  }
  return { customerNames: [...customerNames], schemeNames: [...schemeNames] };
}

/** Escape a string for safe use inside a RegExp (customer name words are data, not trusted patterns). */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** True when {@code word} appears as a whole word in the already-lower-cased query. */
function hasWord(query: string, word: string): boolean {
  return new RegExp(`\\b${escapeRegExp(word)}\\b`).test(query);
}

/** The verdict the query asked for, or null. Checks FLAGGED phrasings first (rarely both appear). */
function parseVerdict(query: string): Verdict | null {
  if (/\b(flag|flagged|fail|failed)\b/.test(query)) {
    return "FLAGGED";
  }
  if (/\b(pass|passed|clean|suitable|cleared)\b/.test(query)) {
    return "PASS";
  }
  return null;
}

/** The supervisor-review state the query asked for, or null. */
function parseApproval(query: string): ApprovalState | null {
  if (/\b(pending|awaiting|unreviewed)\b/.test(query) || /\bnot reviewed\b/.test(query)) {
    return "PENDING";
  }
  if (/\b(approved|overridden)\b/.test(query)) {
    return "APPROVED";
  }
  if (/\b(rejected|upheld)\b/.test(query)) {
    return "REJECTED";
  }
  return null;
}

/** The customer risk category the query asked for, or null. Whole-word so "moderate" ≠ "moderately". */
function parseRiskCategory(query: string): string | null {
  if (hasWord(query, "conservative")) {
    return "CONSERVATIVE";
  }
  if (hasWord(query, "aggressive")) {
    return "AGGRESSIVE";
  }
  if (hasWord(query, "moderate")) {
    return "MODERATE";
  }
  return null;
}

/**
 * The scheme riskometer level the query asked for, or null. Recognised ONLY for explicit "… risk" phrasing
 * ("very high risk", "high risk") so it never collides with the customer risk categories parsed above —
 * "aggressive" is a customer trait, "very high risk" is a scheme trait. Checks most-specific first.
 */
function parseRiskometer(query: string): string | null {
  if (/very high[-\s]?risk/.test(query)) {
    return "VERY_HIGH";
  }
  if (/moderately high[-\s]?risk/.test(query)) {
    return "MODERATELY_HIGH";
  }
  if (/high[-\s]?risk/.test(query)) {
    return "HIGH";
  }
  return null;
}

/** True when the query restricted to senior-citizen customers. */
function parseSenior(query: string): boolean {
  return (
    hasWord(query, "senior") ||
    hasWord(query, "seniors") ||
    hasWord(query, "elderly") ||
    /60\+/.test(query) ||
    /\bover 60\b/.test(query)
  );
}

/** The relative time window the query asked for, or null. */
function parseTime(query: string): TimeWindow | null {
  if (hasWord(query, "today")) {
    return "TODAY";
  }
  if (/\bthis week\b/.test(query) || /\bpast week\b/.test(query) || /\blast 7 days\b/.test(query)) {
    return "WEEK";
  }
  return null;
}

/** The scheme phrasings recognised in the query — curated vocabulary plus any exact scheme-name mention. */
function parseSchemeGroups(query: string, schemeNames: readonly string[]): readonly SchemeGroup[] {
  const groups: SchemeGroup[] = [];
  const seenLabels = new Set<string>();
  for (const entry of SCHEME_VOCAB) {
    if (entry.keywords.some((kw) => query.includes(kw)) && !seenLabels.has(entry.label)) {
      groups.push({ label: entry.label, terms: entry.terms });
      seenLabels.add(entry.label);
    }
  }
  // Direct full-scheme-name mention (grounds a judge typing an exact fund name) — data-driven from the ledger.
  for (const name of schemeNames) {
    if (query.includes(name.toLowerCase()) && !seenLabels.has(name)) {
      groups.push({ label: name, terms: [normalizeSchemeText(name)] });
      seenLabels.add(name);
    }
  }
  return groups;
}

/**
 * The customer full names the query named. A customer matches if the query contains its FULL name, or a
 * name word that is UNIQUE across the whole catalogue (so "sharma" resolves to Sunita Sharma, while a bare
 * "sunita" — shared by two customers — is ambiguous and matches nobody unless the full name is given). Words
 * shorter than three letters are ignored to avoid spurious hits.
 */
function parseCustomers(query: string, customerNames: readonly string[]): readonly string[] {
  const MIN_WORD_LEN = 3;
  // Map each name word to the set of full names that contain it — a word is a usable key only when unique.
  const owners = new Map<string, Set<string>>();
  for (const name of customerNames) {
    for (const word of name.toLowerCase().split(/\s+/)) {
      if (word.length < MIN_WORD_LEN) {
        continue;
      }
      const set = owners.get(word) ?? new Set<string>();
      set.add(name);
      owners.set(word, set);
    }
  }

  const matched = new Set<string>();
  for (const name of customerNames) {
    const lower = name.toLowerCase();
    if (query.includes(lower)) {
      matched.add(name);
      continue;
    }
    for (const word of lower.split(/\s+/)) {
      if (word.length >= MIN_WORD_LEN && owners.get(word)?.size === 1 && hasWord(query, word)) {
        matched.add(name);
        break;
      }
    }
  }
  return [...matched];
}

/**
 * Parse a natural-language query into a typed filter. Case-insensitive; unrecognised text is silently
 * ignored (the recognised dimensions are what {@link describeFilter} shows back). Pure: no clock, no I/O.
 *
 * @param query the raw supervisor query
 * @param catalog distinct customer + scheme names from the loaded ledger (grounds data-driven matches)
 * @returns the interpretation; {@link recognizedDimensionCount} is 0 when nothing was understood
 */
export function parseLedgerQuery(query: string, catalog: LedgerCatalog): LedgerFilter {
  const q = query.toLowerCase();
  return {
    verdict: parseVerdict(q),
    approval: parseApproval(q),
    seniorOnly: parseSenior(q),
    riskCategory: parseRiskCategory(q),
    riskometerLevel: parseRiskometer(q),
    schemeGroups: parseSchemeGroups(q, catalog.schemeNames),
    customerNames: parseCustomers(q, catalog.customerNames),
    time: parseTime(q),
  };
}

/** How many dimensions the parser understood — zero means the query is unparseable (capability card). */
export function recognizedDimensionCount(filter: LedgerFilter): number {
  return (
    (filter.verdict ? 1 : 0) +
    (filter.approval ? 1 : 0) +
    (filter.seniorOnly ? 1 : 0) +
    (filter.riskCategory ? 1 : 0) +
    (filter.riskometerLevel ? 1 : 0) +
    (filter.schemeGroups.length > 0 ? 1 : 0) +
    (filter.customerNames.length > 0 ? 1 : 0) +
    (filter.time ? 1 : 0)
  );
}

/** A record's review state — no override ⇒ PENDING, else the latest review's resulting status (brief §6.1). */
function approvalStateOf(record: DecisionRecord): ApprovalState {
  const last = record.overrides[record.overrides.length - 1];
  return last ? last.resultingStatus : "PENDING";
}

/** A record's scheme text for substring matching: name + category, upper-cased, underscores→spaces. */
function normalizeSchemeText(text: string): string {
  return text.toUpperCase().replace(/_/g, " ");
}

/** Whether a record's creation instant falls inside the given window relative to {@code now}. */
function inTimeWindow(createdAt: string, window: TimeWindow, now: Date): boolean {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) {
    return false;
  }
  if (window === "TODAY") {
    return (
      created.getFullYear() === now.getFullYear() &&
      created.getMonth() === now.getMonth() &&
      created.getDate() === now.getDate()
    );
  }
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  return now.getTime() - created.getTime() <= SEVEN_DAYS_MS;
}

/** Whether one record satisfies every recognised dimension of the filter (AND across dimensions). */
function matchesFilter(record: DecisionRecord, filter: LedgerFilter, now: Date): boolean {
  if (filter.verdict !== null && record.verdict !== filter.verdict) {
    return false;
  }
  if (filter.approval !== null && approvalStateOf(record) !== filter.approval) {
    return false;
  }
  if (filter.seniorOnly && !record.customerSnapshot.seniorCitizen) {
    return false;
  }
  if (filter.riskCategory !== null && record.customerSnapshot.riskCategory !== filter.riskCategory) {
    return false;
  }
  if (filter.riskometerLevel !== null && record.schemeSnapshot.riskometerLevel !== filter.riskometerLevel) {
    return false;
  }
  if (filter.schemeGroups.length > 0) {
    const text = normalizeSchemeText(`${record.schemeSnapshot.name} ${record.schemeSnapshot.category}`);
    const anyGroup = filter.schemeGroups.some((group) => group.terms.some((term) => text.includes(term)));
    if (!anyGroup) {
      return false;
    }
  }
  if (filter.customerNames.length > 0 && !filter.customerNames.includes(record.customerSnapshot.fullName)) {
    return false;
  }
  if (filter.time !== null && !inTimeWindow(record.createdAt, filter.time, now)) {
    return false;
  }
  return true;
}

/**
 * Filter the ledger to the records satisfying the filter (order preserved from the input, i.e. newest-first).
 *
 * @param records the loaded ledger
 * @param filter the parsed interpretation
 * @param now reference instant for relative time windows; injectable for tests, defaults to the wall clock.
 *   This is the ONLY function in the engine that reads the clock (via its default), keeping parse/compose pure.
 * @returns the matching records
 */
export function applyLedgerFilter(
  records: readonly DecisionRecord[],
  filter: LedgerFilter,
  now: Date = new Date(),
): DecisionRecord[] {
  return records.filter((record) => matchesFilter(record, filter, now));
}

/** Title-case one UPPER_SNAKE token for a chip (`VERY_HIGH` → `Very High`). Local to keep the engine standalone. */
function titleCase(token: string): string {
  return token
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** Human labels for the approval states in chips + answers. */
const APPROVAL_LABELS: Record<ApprovalState, string> = {
  PENDING: "Awaiting review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

/** Human labels for the time windows in chips. */
const TIME_LABELS: Record<TimeWindow, string> = {
  TODAY: "Today",
  WEEK: "Last 7 days",
};

/**
 * Human-readable chips of exactly what the parser understood — the honesty device. One chip per recognised
 * dimension, so the supervisor can see the machine's interpretation beside its answer and catch a
 * misunderstanding immediately.
 *
 * @param filter the parsed interpretation
 * @returns display chips (empty when nothing was recognised)
 */
export function describeFilter(filter: LedgerFilter): string[] {
  const chips: string[] = [];
  if (filter.verdict !== null) {
    chips.push(`Verdict: ${filter.verdict === "FLAGGED" ? "Flagged" : "Pass"}`);
  }
  if (filter.approval !== null) {
    chips.push(`Review: ${APPROVAL_LABELS[filter.approval]}`);
  }
  if (filter.seniorOnly) {
    chips.push("Senior citizens");
  }
  if (filter.riskCategory !== null) {
    chips.push(`Risk profile: ${titleCase(filter.riskCategory)}`);
  }
  if (filter.riskometerLevel !== null) {
    chips.push(`Scheme risk: ${titleCase(filter.riskometerLevel)}`);
  }
  for (const group of filter.schemeGroups) {
    chips.push(`Scheme: ${group.label}`);
  }
  for (const name of filter.customerNames) {
    chips.push(`Customer: ${name}`);
  }
  if (filter.time !== null) {
    chips.push(`When: ${TIME_LABELS[filter.time]}`);
  }
  return chips;
}

/** Count how the matches split by review state. */
function approvalBreakdown(matches: readonly DecisionRecord[]): Record<ApprovalState, number> {
  const counts: Record<ApprovalState, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0 };
  for (const record of matches) {
    counts[approvalStateOf(record)] += 1;
  }
  return counts;
}

/** The newest record in a set by creation instant (ISO-8601 sorts lexicographically == chronologically). */
function newestOf(matches: readonly DecisionRecord[]): DecisionRecord | null {
  return matches.reduce<DecisionRecord | null>(
    (newest, record) => (newest === null || record.createdAt > newest.createdAt ? record : newest),
    null,
  );
}

/**
 * Compose the answer sentence(s) from REAL counts. Zero matches yields an honest "no proposals match" that
 * names the understood filters (so a supervisor sees the interpretation, not just an empty result).
 *
 * @param matches the filtered records
 * @param filter the parsed interpretation (its chips name the filters in the zero-match case)
 * @param total the size of the whole ledger (for the "N of M" framing)
 * @returns the answer text — nothing here is generated; every number is counted
 */
export function composeAnswer(
  matches: readonly DecisionRecord[],
  filter: LedgerFilter,
  total: number,
): string {
  const chips = describeFilter(filter);
  const understood = chips.length > 0 ? chips.join(" · ") : "your query";

  if (matches.length === 0) {
    return `No proposals in the ledger match ${understood}.`;
  }

  const flagged = matches.filter((r) => r.verdict === "FLAGGED").length;
  const passed = matches.length - flagged;
  const approvals = approvalBreakdown(matches);
  const newest = newestOf(matches);

  const lead = `Found ${matches.length} of ${total} proposal${matches.length === 1 ? "" : "s"} matching ${understood}.`;
  const verdictLine = `Verdicts: ${flagged} flagged, ${passed} passed.`;
  const approvalLine = `Review: ${approvals.PENDING} awaiting, ${approvals.APPROVED} approved, ${approvals.REJECTED} rejected.`;
  const newestLine = newest
    ? `Newest: ${newest.certificateNumber} — ${newest.customerSnapshot.fullName}, ${newest.schemeSnapshot.name}.`
    : "";

  return [lead, verdictLine, approvalLine, newestLine].filter((line) => line !== "").join(" ");
}

/**
 * Run one query end-to-end: parse → (capability card when nothing recognised) → filter → compose. This is
 * the single entry point the screen calls; it keeps the "what counts as unparseable" decision inside the
 * engine (testable) rather than in the view.
 *
 * @param query the raw supervisor query
 * @param records the loaded ledger
 * @param catalog distinct customer + scheme names from the ledger
 * @param now reference instant for relative time windows (defaults to the wall clock)
 * @returns a computed answer with matched records, or the capability result when nothing was understood
 */
export function runLedgerQuery(
  query: string,
  records: readonly DecisionRecord[],
  catalog: LedgerCatalog,
  now: Date = new Date(),
): LedgerQueryResult {
  const filter = parseLedgerQuery(query, catalog);
  if (recognizedDimensionCount(filter) === 0) {
    return { kind: "capability" };
  }
  const matches = applyLedgerFilter(records, filter, now);
  return {
    kind: "answer",
    filter,
    chips: describeFilter(filter),
    answer: composeAnswer(matches, filter, records.length),
    matches,
  };
}
