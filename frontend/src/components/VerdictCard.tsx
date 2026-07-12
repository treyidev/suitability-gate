/**
 * The decision record, rendered — the workbench's hero result (brief §14).
 *
 * Layout top-to-bottom: a verdict banner (PASS teal / FLAGGED orange — the brief's colour semantics,
 * kept as saturated OPAQUE fills; §3a forbids glassing the regulatory artifact), a KPI provenance strip
 * (certificate number + "N ms" styled as the headline claims they are — mono/tabular numerals), the
 * one-sentence verdict reason, every rule as a {@link RuleRow}, and an AI-contribution footer that states
 * the thesis in the record's own words: the model explains, it never decides.
 *
 * The explanation prose itself is async ({@link AiContributionFooter} renders it as it arrives —
 * Generating while the downstream service works, Ready once prose is returned, Unavailable if it could
 * not be produced), and it is never invented client-side. A fourth "stopped watching" state (directive
 * §5b honest cancel) covers the RM choosing to stop the poll — the record is unaffected. Gemini is not
 * wired in Phase 1; Ready prose is canned stub text.
 *
 * MOTION: the card's root crossfades + scales in when a new record replaces the old (§7 item 2 — the
 * parent wraps it in `AnimatePresence mode="wait"` keyed on `recordId`); all offsets collapse under
 * `useReducedMotion`.
 */
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import type { AiContribution, DecisionRecord, OverrideStatus } from "../api/types";
import { formatDateTime } from "../format";
import { springGentle, springSnappy } from "../motion";

import { ClockIcon, FlagIcon, ShieldCheckIcon, SparkIcon, XCircleIcon } from "./icons";
import { RiskometerGauge } from "./RiskometerGauge";
import { RuleRow } from "./RuleRow";

/** Per-verdict banner presentation. */
const VERDICT_STYLES = {
  PASS: {
    Icon: ShieldCheckIcon,
    banner: "bg-primary text-white",
    headline: "Suitable",
    sub: "No blocking suitability failures — a supervisor's approval is still required.",
  },
  FLAGGED: {
    // FAILURE = RED (colour re-architecture 2026-07-11). White on --color-danger is only ~3.55:1, so
    // the banner fill uses --color-danger-strong (~5:1 white-on-fill) to hold the AA floor.
    Icon: FlagIcon,
    banner: "bg-danger-strong text-white",
    headline: "Flagged",
    sub: "One or more blocking checks failed — supervisor review required.",
  },
} as const;

/**
 * Customer-audience banner sub-text (owner directive 2026-07-12): the investor sees neutral bank language,
 * never the internal role "supervisor". Same meaning ("a human still has to review"), bank-facing wording.
 * Staff keep {@link VERDICT_STYLES}'s copy.
 */
const CUSTOMER_VERDICT_SUB = {
  PASS: "No blocking suitability failures — a review by the bank is still required.",
  FLAGGED: "One or more blocking checks failed — a review by the bank is required.",
} as const;

/**
 * Who is looking at this card. STAFF (the RM workbench + compliance dashboard) see the full internal
 * framing — the "supervisor approval" step and the AI-contribution provenance footer. CUSTOMER (the
 * investor's transparency portal) must see NEITHER machine/AI involvement NOR internal role wording
 * (owner directive 2026-07-12): the approval step reads as a neutral "bank review" and the explanation is
 * an unbranded plain-language block. The verdict banner, KPI strip, and rule audit are identical for both.
 */
type Audience = "staff" | "customer";

/** Props for {@link VerdictCard}. */
interface VerdictCardProps {
  readonly record: DecisionRecord;
  /** The RM stopped watching the async explanation (client-only; the record is unaffected). */
  readonly explanationWatchStopped: boolean;
  /** Invoked by the footer's "Stop waiting" affordance while the explanation is still generating. */
  readonly onStopWaiting: () => void;
  /**
   * When provided (the compliance drill-down), enables the supervisor review action on a FLAGGED,
   * not-yet-reviewed decision. Omitted in the RM workbench, where review is not offered. Resolves once the
   * review is recorded server-side; the caller then swaps in the reviewed record. Rejects with the API
   * error so the form can show it.
   */
  readonly onReview?: (action: OverrideStatus, justification: string) => Promise<void>;
  /**
   * Which audience is viewing (default {@code "staff"}). {@code "customer"} swaps the supervisor-approval
   * step and the AI-contribution footer for neutral, unbranded equivalents — see {@link Audience}. The two
   * staff callers omit it and are unaffected.
   */
  readonly audience?: Audience;
}

/** Renders a frozen {@link DecisionRecord}. */
export function VerdictCard({
  record,
  explanationWatchStopped,
  onStopWaiting,
  onReview,
  audience = "staff",
}: VerdictCardProps) {
  const reduceMotion = useReducedMotion();
  const style = VERDICT_STYLES[record.verdict];
  const { Icon } = style;
  const { provenance } = record;
  // Customer sees bank-neutral banner wording (no "supervisor"); staff keep the internal copy.
  const bannerSub = audience === "customer" ? CUSTOMER_VERDICT_SUB[record.verdict] : style.sub;

  return (
    <motion.div
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
      transition={springGentle}
      className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm"
    >
      {/* Verdict banner — saturated OPAQUE fill (never glass) */}
      <div className={`flex items-center gap-3 px-5 py-4 ${style.banner}`}>
        <Icon className="h-8 w-8 shrink-0" />
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{style.headline}</span>
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[11px] font-semibold tracking-wide">
              {record.verdict}
            </span>
          </div>
          <p className="text-[13px] text-white/85">{bannerSub}</p>
        </div>
      </div>

      {/* Provenance strip — KPI numerals: the "evaluated in N ms" is a headline claim, styled as one.
          The Risk-o-meter gauge anchors the row as another headline KPI; surface-2's neutral dark keeps
          its teal→orange ramp crisp (the coloured verdict banner above would clash — §6.5). */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-b border-line bg-surface-2 px-5 py-3.5">
        <RiskometerGauge level={record.schemeSnapshot.riskometerLevel} size="md" />
        <KpiStat label="Certificate" value={record.certificateNumber} />
        <KpiStat label="Evaluated in" value={String(provenance.evaluationDurationMs)} unit="ms" />
        <div className="ml-auto text-right text-[11px] leading-relaxed text-muted">
          <div>Ruleset {provenance.rulesetVersion}</div>
          <div>Engine {provenance.engineVersion}</div>
        </div>
      </div>

      {/* Verdict reason */}
      <div className="px-5 pt-4">
        <p className="text-sm leading-relaxed text-ink">{record.verdictReason}</p>
      </div>

      {/* Rule results */}
      <div className="px-5 pt-4 pb-2">
        <h3 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
          Rule checks
        </h3>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {record.ruleResults.map((rule) => (
            <RuleRow key={rule.ruleId} rule={rule} />
          ))}
        </ul>
      </div>

      {/* Human-approval step — "supervisor approval" for staff; a neutral "bank review" for the customer */}
      <SupervisorReview record={record} onReview={onReview} audience={audience} />

      {/* Explanation — staff see the full AI-contribution provenance footer; the customer sees an unbranded
          plain-language block that never discloses the model or its status (owner directive 2026-07-12). */}
      {audience === "customer" ? (
        <PlainLanguageExplanation contribution={record.aiContribution} />
      ) : (
        <AiContributionFooter
          contribution={record.aiContribution}
          watchStopped={explanationWatchStopped}
          onStopWaiting={onStopWaiting}
        />
      )}
    </motion.div>
  );
}

/** Per-outcome presentation for a recorded human decision. */
const REVIEW_STYLES: Record<OverrideStatus, { label: string; className: string; Icon: typeof FlagIcon }> = {
  // Approved = the human let the transaction proceed (teal). On a FLAGGED decision, this is an override.
  APPROVED: { label: "Approved", className: "bg-primary-tint text-primary-bright", Icon: ShieldCheckIcon },
  // Rejected = the human blocked the transaction (red). On a FLAGGED decision, the flag is upheld.
  REJECTED: { label: "Rejected", className: "bg-danger-tint text-danger-bright", Icon: XCircleIcon },
};

/**
 * The supervisor-approval section — the mandatory human-in-the-loop step (brief §6.1). Humans are ALWAYS in
 * the loop: EVERY decision (PASS or FLAGGED) needs a human to approve or reject before it is final, so this
 * renders on every record. Three states: the recorded decision (read-only, once made — shown to any viewer);
 * the approve/reject action form (when {@link onReview} is provided — the compliance drill-down); or an
 * "awaiting approval" note (the RM workbench, where the decision is not yet made and this viewer can't make it).
 *
 * <p>For a {@code "customer"} audience the recorded facts (outcome + justification) stay — that is honest
 * transparency — but the section header is the neutral "Bank review" rather than the internal "Supervisor
 * approval" role wording (owner directive 2026-07-12). A customer never gets {@link onReview}, so they only
 * ever see the recorded decision or the neutral pending note, never the action form.
 */
function SupervisorReview({
  record,
  onReview,
  audience,
}: {
  record: DecisionRecord;
  onReview?: (action: OverrideStatus, justification: string) => Promise<void>;
  audience: Audience;
}) {
  const existing = record.overrides[0];
  // The customer sees the same facts under neutral bank framing — never the internal "supervisor" role.
  const heading = audience === "customer" ? "Bank review" : "Supervisor approval";

  if (existing) {
    const style = REVIEW_STYLES[existing.resultingStatus];
    const { Icon } = style;
    return (
      <div className="mx-5 mb-4 rounded-lg border border-line bg-surface-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
            {heading}
          </span>
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${style.className}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {style.label}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink">{existing.justification}</p>
        <p className="mt-1.5 text-[11px] text-muted">
          by <span className="font-medium text-ink">{existing.overriddenBy}</span> ·{" "}
          {formatDateTime(existing.createdAt)}
        </p>
      </div>
    );
  }

  // Not yet decided. A supervisor (onReview provided) gets the action form; anyone else sees a pending note.
  return onReview ? <ReviewForm onReview={onReview} /> : <AwaitingApproval audience={audience} heading={heading} />;
}

/**
 * Pending state for a viewer who cannot act. Staff (the RM workbench) see the supervisor-approval framing
 * and the "no transaction is final until a human signs off" assurance; the customer view (owner directive
 * 2026-07-12) sees neutral bank language that discloses neither the internal "supervisor" role nor that
 * phrasing — just that the bank is reviewing.
 */
function AwaitingApproval({ audience, heading }: { audience: Audience; heading: string }) {
  const customer = audience === "customer";
  return (
    <div className="mx-5 mb-4 rounded-lg border border-line bg-surface-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
          {heading}
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-semibold text-accent-bright">
          <ClockIcon className="h-3.5 w-3.5" />
          {customer ? "Under review" : "Pending"}
        </span>
      </div>
      <p className="mt-2 text-[12px] text-muted">
        {customer
          ? "This decision is under review by the bank."
          : "Awaiting a supervisor's approval — no transaction is final until a human signs off."}
      </p>
    </div>
  );
}

/** The action form — justification + approve/reject, owning its own submit + error state. */
function ReviewForm({
  onReview,
}: {
  onReview: (action: OverrideStatus, justification: string) => Promise<void>;
}) {
  const [justification, setJustification] = useState("");
  const [pending, setPending] = useState<OverrideStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canSubmit = justification.trim().length > 0 && pending === null;

  async function submit(action: OverrideStatus) {
    if (!canSubmit) {
      return;
    }
    setPending(action);
    setError(null);
    try {
      await onReview(action, justification.trim());
      // On success the parent swaps in the decided record, so this form unmounts — no reset needed.
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record the decision.");
      setPending(null);
    }
  }

  return (
    <div className="mx-5 mb-4 rounded-lg border border-line bg-surface-2 px-4 py-3.5">
      <span className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
        Supervisor approval
      </span>
      <p className="mt-1 text-[12px] text-muted">
        Approve or reject this transaction — a justification is required.
      </p>
      <textarea
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
        rows={2}
        placeholder="Justification (required) — e.g. reviewed with customer; risk understood and accepted."
        aria-label="Approval justification"
        className="field-inset mt-2.5 w-full resize-none rounded-lg px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:outline-none"
      />
      {error && <p className="mt-2 text-[12px] text-danger-bright">{error}</p>}
      <div className="mt-2.5 flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => submit("APPROVED")}
          className="btn-primary-fill inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold text-white transition-[filter] hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ShieldCheckIcon className="h-4 w-4" />
          {pending === "APPROVED" ? "Recording…" : "Approve"}
        </button>
        <button
          type="button"
          disabled={!canSubmit}
          onClick={() => submit("REJECTED")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-danger-bright/40 bg-surface px-3.5 py-2 text-[13px] font-semibold text-danger-bright transition-colors hover:bg-danger-tint disabled:cursor-not-allowed disabled:opacity-50"
        >
          <XCircleIcon className="h-4 w-4" />
          {pending === "REJECTED" ? "Recording…" : "Reject"}
        </button>
      </div>
    </div>
  );
}

/** One KPI numeral with a tiny uppercase label — mono + tabular so figures line up (directive §6.3). */
function KpiStat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <div className="text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1 font-mono text-[22px] leading-none font-semibold tabular-nums text-ink">
        {value}
        {unit && <span className="text-[13px] font-medium text-muted">{unit}</span>}
      </div>
    </div>
  );
}

/** The four presentation states of the explanation status pill (directive §6.3 + §5b stopped state). */
type DisplayState = "GENERATING" | "READY" | "UNAVAILABLE" | "STOPPED";

/**
 * Reference-style filled pill per state (colour re-architecture 2026-07-11): Generating = ORANGE
 * (processing energy, pairs with its orange working border), Ready = green success, Unavailable = red
 * failure; STOPPED is a quiet neutral chip. White text — see the contrast note in the report (these
 * small status pills sit below the 4.5:1 normal-text floor; they read as status indicators).
 */
const PILL_STYLES: Record<DisplayState, { label: string; className: string }> = {
  GENERATING: { label: "Generating", className: "bg-accent text-white" },
  READY: { label: "Ready", className: "bg-success text-white" },
  UNAVAILABLE: { label: "Unavailable", className: "bg-danger text-white" },
  STOPPED: { label: "Stopped watching", className: "border border-line bg-surface-2 text-muted" },
};

/**
 * The customer-facing explanation block — the plain-language summary with NO machine/AI branding.
 *
 * WHY a separate component from {@link AiContributionFooter}: the staff footer is the thesis-auditability
 * centrepiece (Spark icon, "AI contribution", Contributed / Did-not-contribute lines, provider name, live
 * status pills). The customer view must disclose none of that — not the model, not the provider, not that
 * the bank uses AI at all, and not the async machinery (owner directive 2026-07-12). So this shows only the
 * finished prose when one is {@code ATTACHED}, and stays quiet otherwise: a still-generating or failed
 * explanation reads simply as "not available" rather than exposing a pipeline the customer shouldn't see.
 */
function PlainLanguageExplanation({ contribution }: { contribution: AiContribution }) {
  const hasText = contribution.explanationStatus === "ATTACHED" && Boolean(contribution.explanationText);
  return (
    <div className="mx-5 my-4 rounded-lg border border-line bg-surface-2 px-4 py-3">
      <h3 className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">In plain language</h3>
      {hasText ? (
        <p className="mt-2 text-[13px] leading-relaxed text-ink">{contribution.explanationText}</p>
      ) : (
        <p className="mt-2 text-[12px] text-muted">
          A plain-language summary is not available for this decision.
        </p>
      )}
    </div>
  );
}

/**
 * The AI-contribution footer — the thesis made auditable, plus the async explanation as it resolves.
 *
 * States track the backend {@code ExplanationStatus} plus the client-only "stopped watching": GENERATING
 * shows a live working-border pill + an immediate "Stop waiting" affordance while the downstream service
 * works; READY renders the returned prose (only ever displayed, never invented here) after a single
 * spring tick; UNAVAILABLE states honestly that the prose is absent while the verdict and its audit trail
 * stand; STOPPED settles quietly when the RM stopped the poll (the record may still gain prose
 * server-side). The thesis line shows in every state — it is the auditability centrepiece, not chrome.
 */
function AiContributionFooter({
  contribution,
  watchStopped,
  onStopWaiting,
}: {
  contribution: AiContribution;
  watchStopped: boolean;
  onStopWaiting: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const { explanationStatus, provider, explanationText } = contribution;

  const displayState: DisplayState =
    explanationStatus === "ATTACHED"
      ? "READY"
      : explanationStatus === "FAILED"
        ? "UNAVAILABLE"
        : watchStopped
          ? "STOPPED"
          : "GENERATING";

  const pill = PILL_STYLES[displayState];
  // The working border is truthful status (only while genuinely generating) — static under reduced motion.
  const pillBorderClass =
    displayState === "GENERATING" ? (reduceMotion ? "working-border-static" : "working-border") : "";

  return (
    <div className="mx-5 my-4 rounded-lg border border-primary-bright/20 bg-primary-tint px-4 py-3">
      <div className="flex items-center gap-2 text-primary-bright">
        <SparkIcon className="h-4 w-4" />
        <span className="text-[12px] font-semibold">AI contribution</span>
        <div className="ml-auto flex items-center gap-2.5">
          {displayState === "GENERATING" && (
            <button
              type="button"
              onClick={onStopWaiting}
              className="text-[11px] font-medium text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
            >
              Stop waiting
            </button>
          )}
          {/* Single spring tick on each state change (§7 item 4) — keyed so the pill re-mounts. */}
          <motion.span
            key={displayState}
            initial={reduceMotion ? false : { scale: 0.8 }}
            animate={{ scale: 1 }}
            transition={springSnappy}
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${pill.className} ${pillBorderClass}`}
          >
            {pill.label}
          </motion.span>
        </div>
      </div>

      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
        <span className="font-medium text-ink">Contributed:</span> {contribution.contributed}.{" "}
        <span className="font-medium text-ink">Did not contribute:</span> {contribution.didNotContribute}.
      </p>

      {/* Explanation region — resolves as the async prose arrives, or settles quietly if stopped */}
      {displayState === "GENERATING" && (
        <p className="mt-2.5 text-[12px] text-muted">Generating a plain-language explanation…</p>
      )}

      {displayState === "STOPPED" && (
        <p className="mt-2.5 border-t border-primary-bright/15 pt-2.5 text-[12px] text-muted">
          Stopped watching. The explanation may still attach to this record server-side — reopen the
          record later to check. The verdict and its audit trail are unaffected.
        </p>
      )}

      {displayState === "READY" && explanationText && (
        <motion.div
          initial={{ opacity: 0, y: reduceMotion ? 0 : 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springGentle}
          className="mt-2.5 border-t border-primary-bright/15 pt-2.5"
        >
          <p className="text-[13px] leading-relaxed text-ink">{explanationText}</p>
          {provider && (
            <p className="mt-1.5 text-[10px] font-medium tracking-wide text-muted uppercase">
              Generated by {provider}
            </p>
          )}
        </motion.div>
      )}

      {displayState === "UNAVAILABLE" && (
        <p className="mt-2.5 border-t border-primary-bright/15 pt-2.5 text-[12px] text-muted">
          Explanation unavailable — the verdict and its full audit trail above stand unaffected.
        </p>
      )}
    </div>
  );
}
