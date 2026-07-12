/**
 * The ROLE_RM face — the relationship manager's evaluation workbench (brief §14), inside the app shell.
 *
 * Three-step guided flow (owner-directed 2026-07-12), left panel → right panel:
 *   1. SUGGEST (optional co-pilot) — pick a customer, then "Suggest a plan": the AI-assisted proposer
 *      fills the scheme/amount/type fields with a plan that clears the gate, plus a rationale. It is an
 *      advisory INPUT — the RM reviews/edits it; it is never a verdict. (Phase 1: a rules-aware
 *      deterministic proposer; a live model drops in behind the same backend seam in Phase 2.)
 *   2. EVALUATE (check) — runs the deterministic gate WITHOUT recording anything and shows a
 *      {@link PreviewCard}: verdict + reason + rule rows. The RM can tweak and re-check freely.
 *   3. SUBMIT (commit) — records the frozen {@link DecisionRecord} and routes it to the supervisor's
 *      compliance dashboard for the mandatory human approval; the full {@link VerdictCard} then renders.
 *
 * The thesis holds throughout: AI proposes · human accepts · CODE decides the verdict · human approves.
 * The RM identity is added server-side from the token, never sent here.
 *
 * State lives in this one screen (useState + a load effect) — there is no cross-screen sharing to
 * justify a store, and keeping it local means the whole flow is readable in one file. The form can also be
 * seeded from the Prospects co-pilot: an optional {@link RmWorkbenchProps.prefill} (a customer + a suggested
 * plan) initialises the fields on mount, exactly as the in-form "Suggest a plan" does, and a successful
 * Submit calls {@link RmWorkbenchProps.onSubmitted} so the workspace can drop that customer's Prospects
 * card. Changing any proposal field clears the downstream preview/record (they are now stale) via the
 * wrapped change handlers, so the RM never submits a result that no longer matches the form.
 *
 * IN-FLIGHT PATTERN (directive §5b): Evaluate and Submit show the "working border" while genuinely busy,
 * held to a ~1s minimum (owner-directed presentation staging — see {@link MIN_ACTION_BUSY_MS}). A >2s
 * progressive-disclosure Cancel (AbortController) appears only if Evaluate runs long. The explanation
 * watch on a committed record offers an honest "Stop waiting" that halts polling without touching it.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import {
  ApiError,
  evaluate,
  fetchCustomers,
  fetchRecord,
  fetchSchemes,
  previewEvaluation,
  suggestPlan,
} from "../api/client";
import type {
  CustomerProfile,
  DecisionRecord,
  EvaluationPreview,
  ProposedPlan,
  Scheme,
  TransactionType,
} from "../api/types";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "../components/AppShell";
import type { NavHandlers } from "../components/AppShell";
import { AttributeChip } from "../components/AttributeChip";
import { GlowButton } from "../components/GlowButton";
import { ShieldCheckIcon, SparkIcon } from "../components/icons";
import { PreviewCard } from "../components/PreviewCard";
import { RiskometerGauge } from "../components/RiskometerGauge";
import { SelectField } from "../components/SelectField";
import type { SelectOption } from "../components/SelectField";
import { TextField } from "../components/TextField";
import { VerdictCard } from "../components/VerdictCard";
import { formatInr, formatMonths, humanizeLabel, TRANSACTION_TYPE_LABELS } from "../format";
import { springSnappy } from "../motion";

/** The two transaction shapes, for the segmented control. */
const TRANSACTION_TYPES: readonly TransactionType[] = ["LUMPSUM", "SIP"];

/** How often to re-read the record while its explanation is still PENDING. */
const EXPLANATION_POLL_INTERVAL_MS = 1000;

/**
 * Safety cap on explanation polls (~15 s total). The async handler fails soft — a down explanation
 * service resolves to FAILED within a poll or two — so this only bounds the pathological case where
 * the event never fires and the status would otherwise stay PENDING forever.
 */
const MAX_EXPLANATION_POLLS = 15;

/**
 * Minimum time the Evaluate/Submit actions stay "busy" (owner-directed override of the no-artificial-delay
 * rule, §5b amendment 2026-07-11): the working border is otherwise invisible on a sub-second localhost
 * response. We hold the busy state until BOTH the real response AND this minimum have elapsed. This is
 * presentation staging only — the verdict card still shows the record's TRUE engine
 * `evaluationDurationMs`; nothing about the measurement is padded.
 */
const MIN_ACTION_BUSY_MS = 1000;

/**
 * How long a real Evaluate request must stay in flight before the Cancel affordance is revealed (§5b
 * progressive disclosure). Set above {@link MIN_ACTION_BUSY_MS} so the presentation hold alone can never
 * trip it — Cancel appears only on a genuinely slow (hung-network) request.
 */
const CANCEL_DISCLOSURE_MS = 2000;

/** Props for {@link RmWorkbench} — all optional so it still renders standalone (e.g. a single-screen role). */
interface RmWorkbenchProps {
  /** In-app nav rail handlers (Evaluate ↔ Prospects); omitted when there is no sibling screen. */
  readonly nav?: NavHandlers;
  /**
   * A customer + suggested plan handed in from the Prospects co-pilot to seed the form on mount; null for a
   * clean start. Seeded via the initial {@code useState} values (the screen re-mounts on every rail switch),
   * so it never clobbers an in-progress edit.
   */
  readonly prefill?: { readonly customerId: string; readonly plan: ProposedPlan } | null;
  /** Called with the customer id after a successful Submit, so the workspace can drop that Prospects card. */
  readonly onSubmitted?: (customerId: string) => void;
}

/** RM workbench — proposal builder (Suggest → Evaluate → Submit) + verdict. */
export function RmWorkbench({ nav, prefill, onSubmitted }: RmWorkbenchProps = {}) {
  const { token } = useAuth();
  const reduceMotion = useReducedMotion();

  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Seed the proposal from a Prospects-co-pilot prefill on mount (null ⇒ a clean form). The screen re-mounts
  // on every rail switch, so mount-time seeding is enough — no effect that could clobber a later edit.
  const [customerId, setCustomerId] = useState(prefill?.customerId ?? "");
  const [schemeId, setSchemeId] = useState(prefill?.plan.schemeId ?? "");
  const [amount, setAmount] = useState(prefill ? String(prefill.plan.amountInr) : "");
  const [transactionType, setTransactionType] = useState<TransactionType>(
    prefill?.plan.transactionType ?? "LUMPSUM",
  );

  // Step 1 — Suggest (co-pilot). `suggestion` drives the rationale note; `noSuggestion` the "none passed" note.
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  // A prefill from Prospects IS a suggested plan, so show its rationale note on mount just like "Suggest a plan".
  const [suggestion, setSuggestion] = useState<ProposedPlan | null>(prefill?.plan ?? null);
  const [noSuggestion, setNoSuggestion] = useState(false);

  // Step 2 — Evaluate (check). A non-persisted preview the RM reviews before committing.
  const [preview, setPreview] = useState<EvaluationPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [showPreviewCancel, setShowPreviewCancel] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);

  // Step 3 — Submit (commit). The frozen record, once recorded.
  const [record, setRecord] = useState<DecisionRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  /** Client-only: the RM chose to stop watching the committed record's async explanation (record unaffected). */
  const [explanationWatchStopped, setExplanationWatchStopped] = useState(false);

  // Load the pickers once. `active` guards against a setState after unmount (StrictMode double-mount).
  useEffect(() => {
    if (!token) {
      return;
    }
    let active = true;
    setLoading(true);
    Promise.all([fetchCustomers(token), fetchSchemes(token)])
      .then(([loadedCustomers, loadedSchemes]) => {
        if (!active) return;
        setCustomers(loadedCustomers);
        setSchemes(loadedSchemes);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setLoadError(
          err instanceof ApiError ? err.message : "Could not load customers and schemes.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token]);

  // Poll for the async explanation on the COMMITTED record. Submit returns the record with the explanation
  // still PENDING (the verdict never waits on the LLM); this re-reads it until the downstream service
  // attaches prose or fails — unless the RM stopped watching. Keyed on `record` so a new submit or unmount
  // cancels a stale poll via cleanup, and `cancelled` guards an in-flight fetch from overwriting a newer record.
  useEffect(() => {
    if (
      !token ||
      !record ||
      record.aiContribution.explanationStatus !== "PENDING" ||
      explanationWatchStopped
    ) {
      return;
    }
    const recordId = record.recordId;
    let cancelled = false;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      fetchRecord(token, recordId)
        .then((updated) => {
          if (cancelled) return;
          if (updated.aiContribution.explanationStatus !== "PENDING") {
            setRecord(updated); // flips status → effect re-runs → guard returns → interval cleared
          } else if (attempts >= MAX_EXPLANATION_POLLS) {
            clearInterval(timer); // give up; leave the record showing PENDING
          }
        })
        .catch(() => {
          // A failed re-read (e.g. token expiry) must not spin — stop and keep the last-known record.
          if (!cancelled) clearInterval(timer);
        });
    }, EXPLANATION_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [token, record, explanationWatchStopped]);

  const selectedCustomer = customers.find((c) => c.customerId === customerId) ?? null;
  const selectedScheme = schemes.find((s) => s.schemeId === schemeId) ?? null;

  const customerOptions = useMemo<SelectOption[]>(
    () =>
      customers.map((c) => ({
        value: c.customerId,
        label: `${c.fullName} · ${c.ageYears}y · ${humanizeLabel(c.riskCategory)}`,
      })),
    [customers],
  );
  const schemeOptions = useMemo<SelectOption[]>(
    () =>
      schemes.map((s) => ({
        value: s.schemeId,
        label: `${s.name} · ${humanizeLabel(s.riskometerLevel)} risk`,
      })),
    [schemes],
  );

  const amountValue = Number(amount);
  // The proposal is submittable (all fields valid); the button's disabled state uses this, while its
  // busy state uses `previewing` — busy must NOT dim the button (the glow has to read).
  const fieldsReady =
    customerId !== "" && schemeId !== "" && Number.isFinite(amountValue) && amountValue > 0;

  /** Any change to the proposal invalidates a prior check/commit — clear them so nothing stale is shown. */
  function clearResults(): void {
    setPreview(null);
    setRecord(null);
    setPreviewError(null);
    setSubmitError(null);
  }

  // Wrapped field-change handlers: update the field AND clear stale downstream results. A new customer
  // resets the WHOLE proposal (scheme/amount/type were chosen for the old customer — owner-reported bug
  // 2026-07-12: they must not carry over) plus the suggestion; editing scheme/amount/type keeps the
  // rationale note (a record of what was suggested) but still invalidates the preview/record.
  function changeCustomer(value: string): void {
    setCustomerId(value);
    setSchemeId("");
    setAmount("");
    setTransactionType("LUMPSUM");
    clearResults();
    setSuggestion(null);
    setNoSuggestion(false);
    setSuggestError(null);
  }
  function changeScheme(value: string): void {
    setSchemeId(value);
    clearResults();
  }
  function changeAmount(value: string): void {
    setAmount(value.replace(/[^\d]/g, ""));
    clearResults();
  }
  function changeTransactionType(type: TransactionType): void {
    setTransactionType(type);
    clearResults();
  }

  /** Step 1 — ask the co-pilot for a suitable plan and populate the form (the RM then reviews/edits). */
  async function handleSuggest(): Promise<void> {
    if (!token || customerId === "" || suggesting) {
      return;
    }
    setSuggestError(null);
    setNoSuggestion(false);
    setSuggesting(true);
    try {
      const result = await suggestPlan(token, customerId);
      if (result.available && result.plan) {
        // Populate via raw setters (not the wrapped change handlers), then clear stale results once — the
        // rationale note below is set after, so clearResults() must not run per-field and wipe it.
        setSchemeId(result.plan.schemeId);
        setAmount(String(result.plan.amountInr));
        setTransactionType(result.plan.transactionType);
        clearResults();
        setSuggestion(result.plan);
      } else {
        setSuggestion(null);
        setNoSuggestion(true);
      }
    } catch (err) {
      setSuggestError(
        err instanceof ApiError ? err.message : "Could not fetch a suggestion. Is the server running?",
      );
    } finally {
      setSuggesting(false);
    }
  }

  /** Step 2 — Evaluate: preview the verdict WITHOUT recording (reuses the busy/cancel pattern). */
  async function handlePreview(): Promise<void> {
    if (!token || !fieldsReady || previewing) {
      return;
    }
    setPreviewError(null);
    setRecord(null); // a fresh check supersedes any prior committed record on screen
    const controller = new AbortController();
    previewAbortRef.current = controller;
    setPreviewing(true);
    setShowPreviewCancel(false);
    const cancelTimer = window.setTimeout(() => setShowPreviewCancel(true), CANCEL_DISCLOSURE_MS);
    try {
      // Hold busy for max(real response, MIN_ACTION_BUSY_MS). On rejection Promise.all rejects immediately.
      const [result] = await Promise.all([
        previewEvaluation(
          token,
          { customerId, schemeId, amountInr: amountValue, transactionType },
          controller.signal,
        ),
        new Promise<void>((resolve) => window.setTimeout(resolve, MIN_ACTION_BUSY_MS)),
      ]);
      setPreview(result);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Quiet revert (§5b): the RM stopped waiting; not an error. A preview records nothing regardless.
      } else {
        // Backend is source of truth (e.g. amount below scheme minimum → 400); show its message.
        setPreviewError(
          err instanceof ApiError ? err.message : "Evaluation failed. Is the server running?",
        );
      }
    } finally {
      window.clearTimeout(cancelTimer);
      previewAbortRef.current = null;
      setPreviewing(false);
      setShowPreviewCancel(false);
    }
  }

  /** Abort the in-flight preview fetch (only reachable via the >2s progressive-disclosure affordance). */
  function cancelPreview(): void {
    previewAbortRef.current?.abort();
  }

  /** Step 3 — Submit: commit the previewed proposal to the ledger and route it to the supervisor. */
  async function handleSubmit(): Promise<void> {
    if (!token || !preview || submitting) {
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const [committed] = await Promise.all([
        evaluate(token, { customerId, schemeId, amountInr: amountValue, transactionType }),
        new Promise<void>((resolve) => window.setTimeout(resolve, MIN_ACTION_BUSY_MS)),
      ]);
      setExplanationWatchStopped(false);
      setRecord(committed); // the committed VerdictCard supersedes the preview
      setPreview(null);
      onSubmitted?.(customerId); // tell the workspace to drop this customer's Prospects card (it's been actioned)
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : "Submit failed. Is the server running?");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="Evaluate a transaction" nav={nav}>
      <div className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
        <p className="mb-6 text-sm text-muted">
          Check a proposed mutual-fund purchase against the suitability gate before it is placed.
        </p>

        {loadError ? (
          <div className="rounded-lg border border-danger/40 bg-danger-tint px-4 py-3 text-sm text-danger-bright">
            {loadError}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr]">
            {/* ── Proposal panel ─────────────────────────────────────────────── */}
            <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <h3 className="mb-4 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
                Proposal
              </h3>

              <div className="space-y-4">
                <div>
                  <SelectField
                    id="customer"
                    label="Customer"
                    value={customerId}
                    onChange={changeCustomer}
                    options={customerOptions}
                    placeholder={loading ? "Loading customers…" : "Select a customer"}
                    disabled={loading}
                  />
                  {selectedCustomer && <CustomerContext customer={selectedCustomer} />}
                </div>

                {/* Step 1 — co-pilot: suggest a suitable plan for the selected customer */}
                <div className="space-y-2">
                  <GlowButton
                    type="button"
                    label="Suggest a plan"
                    busyLabel="Suggesting…"
                    busy={suggesting}
                    disabled={customerId === ""}
                    onClick={handleSuggest}
                  />
                  {suggestError && (
                    <p className="rounded-lg border border-danger/40 bg-danger-tint px-3.5 py-2.5 text-[13px] text-danger-bright">
                      {suggestError}
                    </p>
                  )}
                  {suggestion && <SuggestionNote plan={suggestion} />}
                  {noSuggestion && <NoSuggestionNote />}
                </div>

                <div>
                  <SelectField
                    id="scheme"
                    label="Scheme"
                    value={schemeId}
                    onChange={changeScheme}
                    options={schemeOptions}
                    placeholder={loading ? "Loading schemes…" : "Select a scheme"}
                    disabled={loading}
                  />
                  {selectedScheme && <SchemeContext scheme={selectedScheme} />}
                </div>

                <TextField
                  id="amount"
                  label="Amount (₹)"
                  type="text"
                  value={amount}
                  onChange={changeAmount}
                  placeholder="100000"
                />

                {/* Transaction type — segmented control with one sliding glass thumb (§5a, §6.2). */}
                <div>
                  <span className="mb-1.5 block text-[13px] font-medium text-ink">
                    Transaction type
                  </span>
                  <div
                    role="tablist"
                    aria-label="Transaction type"
                    className="field-inset grid grid-cols-2 gap-1 rounded-lg p-1"
                  >
                    {TRANSACTION_TYPES.map((type) => {
                      const selected = transactionType === type;
                      return (
                        <button
                          key={type}
                          type="button"
                          role="tab"
                          aria-selected={selected}
                          onClick={() => changeTransactionType(type)}
                          className="relative z-10 h-9 rounded-md text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-primary-bright/40"
                        >
                          {selected &&
                            (reduceMotion ? (
                              <span className="absolute inset-0 -z-10 rounded-md border border-primary-bright/40 bg-primary-tint" />
                            ) : (
                              <motion.span
                                layoutId="segthumb"
                                transition={springSnappy}
                                className="absolute inset-0 -z-10 rounded-md border border-primary-bright/40 bg-primary-tint"
                              />
                            ))}
                          <span className={selected ? "text-primary-bright" : "text-muted"}>
                            {TRANSACTION_TYPE_LABELS[type]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {previewError && (
                  <p className="rounded-lg border border-danger/40 bg-danger-tint px-3.5 py-2.5 text-sm text-danger-bright">
                    {previewError}
                  </p>
                )}

                {/* Step 2 — Evaluate: preview the verdict (records nothing) */}
                <div className="space-y-2">
                  <GlowButton
                    type="button"
                    label="Evaluate"
                    busyLabel="Evaluating…"
                    busy={previewing}
                    disabled={!fieldsReady}
                    onClick={handlePreview}
                  />

                  {/* Progressive disclosure: only appears after ~2s of real latency. Copy never implies
                      the evaluation was undone — it stops the client waiting, nothing more. */}
                  {showPreviewCancel && (
                    <button
                      type="button"
                      onClick={cancelPreview}
                      className="w-full text-center text-[12px] font-medium text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
                    >
                      Taking longer than usual — stop waiting for the response
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* ── Result panel: Empty → Preview (Evaluate) → Verdict (Submit) ─── */}
            <section>
              <AnimatePresence mode="wait">
                {record ? (
                  <VerdictCard
                    key={record.recordId}
                    record={record}
                    explanationWatchStopped={explanationWatchStopped}
                    onStopWaiting={() => setExplanationWatchStopped(true)}
                  />
                ) : preview ? (
                  <PreviewCard
                    key="preview"
                    preview={preview}
                    onSubmit={handleSubmit}
                    submitting={submitting}
                    submitError={submitError}
                  />
                ) : (
                  <EmptyResult key="empty" />
                )}
              </AnimatePresence>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

/** Key attributes of the selected customer — orients the RM and foreshadows a likely flag.
 *  (Uses the shared {@link AttributeChip}, also rendered by the customer transparency portal.) */
function CustomerContext({ customer }: { customer: CustomerProfile }) {
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
      <AttributeChip label="Age" value={`${customer.ageYears}`} warn={customer.seniorCitizen} />
      <AttributeChip label="Risk profile" value={humanizeLabel(customer.riskCategory)} />
      <AttributeChip label="Horizon" value={formatMonths(customer.investmentHorizonMonths)} />
      <AttributeChip label="KYC" value={humanizeLabel(customer.kycStatus)} />
      <AttributeChip label="Income" value={formatInr(customer.annualIncomeInr)} />
      <AttributeChip label="Assets" value={formatInr(customer.investableAssetsInr)} />
    </div>
  );
}

/**
 * The AI-assisted suggestion note — the co-pilot's rationale for the plan it just filled in. Clearly
 * labelled as AI-assisted and advisory (the fields below are editable; the gate still decides on Submit).
 */
function SuggestionNote({ plan }: { plan: ProposedPlan }) {
  return (
    <div className="rounded-lg border border-primary-bright/20 bg-primary-tint px-3.5 py-2.5">
      <div className="flex items-center gap-1.5 text-primary-bright">
        <SparkIcon className="h-3.5 w-3.5" />
        <span className="text-[11px] font-semibold tracking-[0.12em] uppercase">AI-assisted suggestion</span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-ink">{plan.rationale}</p>
      <p className="mt-1 text-[11px] text-muted">
        Filled in below — review, edit if needed, then Evaluate.
      </p>
    </div>
  );
}

/** Shown when the co-pilot found no scheme that clears the gate for the selected customer. */
function NoSuggestionNote() {
  return (
    <div className="rounded-lg border border-line bg-surface-2 px-3.5 py-2.5">
      <p className="text-[12px] leading-relaxed text-muted">
        No scheme currently clears the gate for this customer — the co-pilot won't suggest a product its
        own gate would flag. Build a proposal manually below.
      </p>
    </div>
  );
}

/** Key attributes of the selected scheme, headed by the Risk-o-meter gauge (its glanceable risk read).
 *  The gauge owns the risk readout, so there is no redundant "Riskometer" chip in the grid below. */
function SchemeContext({ scheme }: { scheme: Scheme }) {
  return (
    <div className="mt-2.5">
      {/* Gauge on the neutral surface-2 inset keeps the teal→orange ramp crisp; it is the headline risk read. */}
      <div className="flex justify-center rounded-lg border border-line bg-surface-2 py-3">
        <RiskometerGauge level={scheme.riskometerLevel} size="sm" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <AttributeChip label="Category" value={humanizeLabel(scheme.category)} />
        <AttributeChip label="Lock-in" value={formatMonths(scheme.lockInMonths)} />
        <AttributeChip label="Volatility" value={humanizeLabel(scheme.volatilityClass)} />
        <AttributeChip label="Min amount" value={formatInr(scheme.minInvestmentInr)} />
        <AttributeChip label="Code" value={scheme.schemeCode} />
      </div>
    </div>
  );
}

/** Placeholder shown in the result panel before the first evaluation. */
function EmptyResult() {
  return (
    <div className="flex h-full min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <ShieldCheckIcon className="h-9 w-9 text-line" />
      <p className="mt-3 text-sm font-medium text-ink">No decision yet</p>
      <p className="mt-1 max-w-xs text-[13px] text-muted">
        Pick a customer and Suggest a plan — or build one by hand — then Evaluate to preview the verdict.
        Try Mrs. Sharma with the small-cap fund to see a flag.
      </p>
    </div>
  );
}
