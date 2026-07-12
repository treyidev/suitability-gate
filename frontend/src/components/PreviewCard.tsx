/**
 * The pre-submit verdict preview — the RM's "Evaluate" (check) result, before it is committed.
 *
 * Deliberately LIGHTER than {@link VerdictCard} (dashed border, muted "not yet submitted" header, a
 * conditional "Would pass / Would be flagged" chip) so the two-step flow reads at a glance: this is a
 * check, not the record. It shows exactly what the RM needs to decide whether to submit — the verdict,
 * its reason, and every rule row (reusing {@link RuleRow}) — and nothing that only exists once committed
 * (no certificate, provenance, AI explanation, or approval slot; those appear on the {@link VerdictCard}
 * after Submit). Submitting runs the SAME deterministic gate server-side and, being deterministic, yields
 * the identical verdict — so nothing is lost by checking first.
 *
 * The primary action is Submit: it commits the frozen record and routes it to the supervisor's compliance
 * dashboard for approval. A FLAGGED preview is still submittable — the supervisor makes the human call
 * (approve/override or reject); the RM may instead edit the proposal to a passing one.
 */
import { motion, useReducedMotion } from "motion/react";

import type { EvaluationPreview } from "../api/types";
import { springGentle } from "../motion";

import { GlowButton } from "./GlowButton";
import { FlagIcon, ShieldCheckIcon } from "./icons";
import { RuleRow } from "./RuleRow";

/** Per-verdict chip presentation for the preview — conditional wording ("would…") since it isn't recorded yet. */
const PREVIEW_VERDICT_STYLES = {
  PASS: { Icon: ShieldCheckIcon, chip: "bg-primary-tint text-primary-bright", label: "Would pass" },
  FLAGGED: { Icon: FlagIcon, chip: "bg-danger-tint text-danger-bright", label: "Would be flagged" },
} as const;

/** Props for {@link PreviewCard}. */
interface PreviewCardProps {
  readonly preview: EvaluationPreview;
  /** Commit the previewed proposal (Submit) — records it and sends it to the supervisor. */
  readonly onSubmit: () => void;
  /** True while the Submit request is in flight. */
  readonly submitting: boolean;
  /** A Submit failure message (e.g. server rejection), else null. */
  readonly submitError: string | null;
}

/** Renders a non-persisted {@link EvaluationPreview} with a Submit action. */
export function PreviewCard({ preview, onSubmit, submitting, submitError }: PreviewCardProps) {
  const reduceMotion = useReducedMotion();
  const style = PREVIEW_VERDICT_STYLES[preview.verdict];
  const { Icon } = style;

  return (
    <motion.div
      initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
      transition={springGentle}
      className="overflow-hidden rounded-xl border border-dashed border-line bg-surface shadow-sm"
    >
      {/* Header — muted "preview" strip + conditional verdict chip (never the full hero banner) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-5 py-3">
        <span className="text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
          Preview — not yet submitted
        </span>
        <span
          className={`ml-auto inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${style.chip}`}
        >
          <Icon className="h-4 w-4" />
          {style.label}
        </span>
      </div>

      {/* Verdict reason */}
      <div className="px-5 pt-4">
        <p className="text-sm leading-relaxed text-ink">{preview.verdictReason}</p>
      </div>

      {/* Rule results — same rows as the committed card */}
      <div className="px-5 pt-4 pb-2">
        <h3 className="mb-2 text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
          Rule checks
        </h3>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          {preview.ruleResults.map((rule) => (
            <RuleRow key={rule.ruleId} rule={rule} />
          ))}
        </ul>
      </div>

      {/* Submit — the commit that records the decision and routes it to the supervisor */}
      <div className="mt-2 border-t border-line bg-surface-2 px-5 py-4">
        <p className="mb-3 text-[12px] leading-relaxed text-muted">
          Submitting records this decision and sends it to the supervisor's compliance dashboard for
          approval. Nothing is recorded until you submit.
        </p>
        {submitError && (
          <p className="mb-2.5 rounded-lg border border-danger/40 bg-danger-tint px-3.5 py-2.5 text-sm text-danger-bright">
            {submitError}
          </p>
        )}
        <GlowButton
          type="button"
          label="Submit to supervisor"
          busyLabel="Submitting…"
          busy={submitting}
          onClick={onSubmit}
        />
      </div>
    </motion.div>
  );
}
