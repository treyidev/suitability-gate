/**
 * One rule result inside the verdict card — the outcome glyph, the rule name, its severity, the
 * plain-English reason, and (when present) an expandable audit-detail panel (brief §9, §6).
 *
 * The expandable panel is the point: it reveals the rule's exact frozen evidence — the inputs it
 * consumed and the thresholds it applied — so "every number is traceable to the rule and ruleset that
 * produced it" is something the user opens with their own hands, not a claim. A blocking FLAG-fail is
 * tinted orange (it drove the verdict), a PASS teal, a SKIPPED grey.
 *
 * The disclosure is a real <button> with aria-expanded/aria-controls (keyboard + screen-reader
 * correct); the height animation uses the app's existing motion dependency (no extra library for a
 * single collapse) and collapses to an instant toggle under prefers-reduced-motion.
 */
import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { CheckCircleIcon, ChevronDownIcon, MinusCircleIcon, XCircleIcon } from "./icons";
import type { RuleResult } from "../api/types";
import { humanizeToken } from "../format";
import { springSnappy } from "../motion";

/** Per-outcome presentation: which glyph, and the colour classes for the icon + left rail. */
const OUTCOME_STYLES: Record<
  RuleResult["outcome"],
  { Icon: typeof CheckCircleIcon; icon: string; rail: string }
> = {
  PASS: { Icon: CheckCircleIcon, icon: "text-primary-bright", rail: "border-l-primary-bright/60" },
  // FAILURE = RED (colour re-architecture 2026-07-11) — a failed rule reads red, not orange.
  FAIL: { Icon: XCircleIcon, icon: "text-danger-bright", rail: "border-l-danger" },
  SKIPPED: { Icon: MinusCircleIcon, icon: "text-muted", rail: "border-l-line" },
};

/** Severity chip colours: FLAG = red failure, WARN = amber, INFO = neutral (all readable on dark). */
const SEVERITY_STYLES: Record<RuleResult["severity"], string> = {
  FLAG: "bg-danger-tint text-danger-bright",
  WARN: "bg-warning/15 text-warning",
  INFO: "bg-surface-2 text-muted",
};

/** A single rule row with optional expandable audit detail. */
export function RuleRow({ rule }: { rule: RuleResult }) {
  const style = OUTCOME_STYLES[rule.outcome];
  const { Icon } = style;
  const reduceMotion = useReducedMotion();
  const detailId = useId();
  const [expanded, setExpanded] = useState(false);

  const inputs = Object.entries(rule.inputsConsumed);
  const thresholds = Object.entries(rule.thresholdApplied);
  const hasDetail = inputs.length > 0 || thresholds.length > 0;

  const header = (
    <>
      <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.icon}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-semibold text-ink">{humanizeToken(rule.ruleId)}</span>
          {/* Severity is only meaningful for a failure (does it block?); a passing rule doesn't need
              the chip, and showing an orange FLAG tag next to a green check misreads as a flag. */}
          {rule.outcome === "FAIL" && (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${SEVERITY_STYLES[rule.severity]}`}
            >
              {rule.severity}
            </span>
          )}
          {rule.outcome === "SKIPPED" && (
            <span className="text-[11px] text-muted italic">skipped</span>
          )}
          {hasDetail && (
            <motion.span
              className="ml-auto flex"
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={reduceMotion ? { duration: 0 } : springSnappy}
            >
              <ChevronDownIcon className="h-4 w-4 text-muted" />
            </motion.span>
          )}
        </div>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {rule.outcome === "SKIPPED" && rule.skippedReason ? rule.skippedReason : rule.plainEnglish}
        </p>
      </div>
    </>
  );

  return (
    <li className={`border-l-2 ${style.rail} bg-surface`}>
      {hasDetail ? (
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          aria-expanded={expanded}
          aria-controls={detailId}
          className="flex w-full gap-3 py-3 pr-3 pl-3.5 text-left transition-colors hover:bg-surface-2/60"
        >
          {header}
        </button>
      ) : (
        <div className="flex gap-3 py-3 pr-3 pl-3.5">{header}</div>
      )}

      <AnimatePresence initial={false}>
        {expanded && hasDetail && (
          <motion.div
            id={detailId}
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mx-3.5 mb-3 rounded-md border border-line bg-surface-2 px-3.5 py-3">
              {inputs.length > 0 && <AuditGroup label="Inputs consumed" entries={inputs} />}
              {thresholds.length > 0 && (
                <div className={inputs.length > 0 ? "mt-3" : ""}>
                  <AuditGroup label="Threshold applied" entries={thresholds} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

/**
 * One labelled group of the audit panel — a monospaced key→value ledger of the raw frozen data. Keys
 * and values are shown verbatim (not humanised) on purpose: this is the exact evidence as recorded, so
 * it should read as the machine data it is.
 */
function AuditGroup({ label, entries }: { label: string; entries: [string, unknown][] }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-semibold tracking-[0.12em] text-muted uppercase">
        {label}
      </div>
      <dl className="space-y-1">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-baseline justify-between gap-4 font-mono text-[11px]">
            <dt className="text-muted">{key}</dt>
            <dd className="text-right font-medium text-ink">{String(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
