/**
 * Wire types shared with the Java gateway. These mirror the backend's JSON contracts (brief §11) as
 * observed on the live endpoints; only the fields the frontend reads are declared, so drift shows up as
 * a compile error at the call site rather than a silent `undefined`.
 *
 * Typing choice: fields the UI branches on (verdict, outcome, severity, transaction type) are unions;
 * display-only categoricals (risk category, riskometer, KYC status…) are plain `string` so a new
 * backend enum value renders instead of breaking the build.
 */

/** Response from {@code POST /auth/login} (AuthController.LoginResponse). */
export interface LoginResponse {
  /** Signed JWT to send as `Authorization: Bearer <token>` on subsequent calls. */
  token: string;
  /** Granted authority, e.g. `ROLE_RM` or `ROLE_COMPLIANCE`. */
  role: string;
}

/** The demo roles the UI branches on (backend authorities, JWT `role` claim prefixed). ROLE_CUSTOMER is
 * the investor's read-only transparency portal face (a customer sees only their own profile + decisions). */
export type Role = "ROLE_RM" | "ROLE_COMPLIANCE" | "ROLE_CUSTOMER";

/** Lumpsum vs systematic investment plan — the two proposal shapes (backend TransactionType). */
export type TransactionType = "LUMPSUM" | "SIP";

/** Composed decision (brief §9): any FLAG-severity failure ⇒ FLAGGED, otherwise PASS. */
export type Verdict = "PASS" | "FLAGGED";

/** How much a failing rule matters: FLAG blocks, WARN/INFO annotate. */
export type Severity = "FLAG" | "WARN" | "INFO";

/** A single rule's result state. */
export type Outcome = "PASS" | "FAIL" | "SKIPPED";

/** Canonical customer profile (CustomerDirectory / GET /customers). */
export interface CustomerProfile {
  customerId: string;
  fullName: string;
  dateOfBirth: string;
  ageYears: number;
  riskCategory: string;
  riskProfileDate: string;
  /** Null for personas whose source system did not supply income (a real messy-data case). */
  annualIncomeInr: number | null;
  investableAssetsInr: number;
  investmentHorizonMonths: number;
  kycStatus: string;
  kycLastUpdated: string;
  seniorCitizen: boolean;
  branchCode: string;
  sourceSystem: string;
}

/** Canonical scheme (SchemeCatalog / GET /schemes). */
export interface Scheme {
  schemeId: string;
  schemeCode: string;
  name: string;
  category: string;
  riskometerLevel: string;
  lockInMonths: number;
  volatilityClass: string;
  minInvestmentInr: number;
  sourceSystem: string;
}

/** The RM's proposed purchase sent to {@code POST /evaluations} (Submit) and {@code POST
 * /evaluations/preview} (Evaluate). Identity is added from the token server-side — the frontend never
 * sends rmId/branchCode. */
export interface EvaluationRequest {
  customerId: string;
  schemeId: string;
  amountInr: number;
  transactionType: TransactionType;
}

/**
 * A non-persisted verdict preview from {@code POST /evaluations/preview} — the RM's pre-submit check.
 * Deliberately NOT a {@link DecisionRecord}: a preview carries only the verdict, its reason, and the rule
 * results — no certificate, provenance, AI explanation, or approval slot (those exist only once committed
 * via Submit). Determinism guarantees this verdict equals the record a later Submit freezes.
 */
export interface EvaluationPreview {
  verdict: Verdict;
  verdictReason: string;
  ruleResults: RuleResult[];
}

/**
 * The RM co-pilot's suggested plan (the {@code plan} of a {@link PlanSuggestionResponse}). An advisory
 * INPUT the RM accepts/edits — never a verdict. Phase 1 is a rules-aware deterministic proposer (a live
 * model drops in behind the same backend seam in Phase 2).
 */
export interface ProposedPlan {
  schemeId: string;
  schemeName: string;
  amountInr: number;
  transactionType: TransactionType;
  /** RM-facing sentence: why this plan fits and clears the gate. */
  rationale: string;
}

/**
 * Response from {@code POST /suggestions}. {@code available} is false — with {@code plan} null — when no
 * scheme in the catalogue clears the gate for the customer (an honest "none", not an error): the co-pilot
 * never suggests a product its own gate would flag.
 */
export interface PlanSuggestionResponse {
  available: boolean;
  plan: ProposedPlan | null;
}

/**
 * One row of the RM "Prospects" co-pilot worklist ({@code GET /prospects}) — a customer paired with a
 * gate-passing suggested plan, plus whether they already have a decision on record. Advisory only: the
 * {@link plan} comes from the same deterministic proposer as {@link PlanSuggestionResponse}, and the RM
 * still Evaluates + Submits through the gate. {@link alreadyServed} is a display signal (an established
 * client vs a fresh prospect), derived server-side — the RM never reads the cross-RM ledger directly.
 */
export interface Prospect {
  customer: CustomerProfile;
  plan: ProposedPlan;
  alreadyServed: boolean;
}

/** One rule's outcome within a decision (brief §9). */
export interface RuleResult {
  ruleId: string;
  ruleVersion: string;
  severity: Severity;
  outcome: Outcome;
  /** Present only when {@link outcome} is `SKIPPED` (a capability was unavailable). */
  skippedReason: string | null;
  /** The exact inputs this rule read (frozen for audit); shape varies per rule. */
  inputsConsumed: Record<string, unknown>;
  /** The threshold values applied (from the versioned ruleset); shape varies per rule. */
  thresholdApplied: Record<string, unknown>;
  /** Human-readable explanation of the result — the row's main text. */
  plainEnglish: string;
  /** True when this is a FLAG-severity FAIL that drove the verdict to FLAGGED. */
  blockingFailure: boolean;
}

/** The AI-contribution statement frozen into every record — the thesis, made auditable. */
export interface AiContribution {
  /** What the AI is allowed to contribute (explanation prose only). */
  contributed: string;
  /** What the AI never contributes (verdict, outcomes, numbers, judgments). */
  didNotContribute: string;
  /**
   * Async explanation lifecycle (mirrors backend {@code ExplanationStatus}): PENDING when the record is
   * first frozen, then the async handler attaches prose (ATTACHED) or records failure (FAILED). Gemini
   * is not wired in P1 — ATTACHED carries canned stub text.
   */
  explanationStatus: "PENDING" | "ATTACHED" | "FAILED";
  /** The provider once rendered, else null. */
  provider: string | null;
  /** The rendered explanation prose once ready, else null. */
  explanationText: string | null;
}

/** How/with-what the decision was judged — the "evaluated in Nms" proof and versions (brief §6). */
export interface Provenance {
  dataSource: string;
  engineVersion: string;
  rulesetVersion: string;
  evaluationDurationMs: number;
  capabilities: { holdingsAvailable: boolean };
}

/** The outcome of a supervisor's mandatory human decision on a record (backend {@code OverrideStatus},
 * brief §6.1). On a FLAGGED decision, APPROVED = override the flag / REJECTED = uphold it; on a PASS,
 * APPROVED = confirm / REJECTED = a human blocking a clean one. */
export type OverrideStatus = "APPROVED" | "REJECTED";

/** A supervisor's human decision on a decision record — a separate appended event (brief §6.1). Humans are
 * always in the loop: every decision (PASS or FLAGGED) requires one before it is final; the frozen record
 * is never mutated (the decision is stitched on read). */
export interface OverrideEvent {
  overrideId: string;
  recordId: string;
  createdAt: string;
  /** The supervisor's identity, from their JWT (never the request body). */
  overriddenBy: string;
  justification: string;
  resultingStatus: OverrideStatus;
}

/** THE artifact — the immutable decision record (brief §6), returned by POST /evaluations and
 * GET /records/{id}. Snapshots are embedded for exact replay. */
export interface DecisionRecord {
  recordId: string;
  certificateNumber: string;
  createdAt: string;
  proposal: EvaluationRequest & { rmId: string; branchCode: string };
  customerSnapshot: CustomerProfile;
  holdingsSnapshot: unknown | null;
  schemeSnapshot: Scheme;
  ruleResults: RuleResult[];
  verdict: Verdict;
  verdictReason: string;
  aiContribution: AiContribution;
  provenance: Provenance;
  /** Supervisor reviews stitched onto the record on read (brief §6.1); empty until reviewed. */
  overrides: OverrideEvent[];
}
