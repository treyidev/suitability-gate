package com.treyi.suitabilitygate.suitability;

import java.util.List;
import java.util.Objects;

/**
 * The engine's output for one evaluation: the individual rule results plus the composed verdict.
 *
 * <p>This is what any {@link SuitabilityEvaluator} returns, and what the pipeline freezes into the
 * DecisionRecord. {@code verdictReason} is one sentence composed from the blocking (FLAG-FAIL) results
 * — the human-readable "why" behind the verdict.
 *
 * @param results       every rule result produced (order preserved); never null
 * @param verdict       the composed verdict (any FLAG-FAIL ⇒ FLAGGED)
 * @param verdictReason one-sentence explanation composed from blocking failures
 */
public record EvaluationOutcome(List<RuleResult> results, Verdict verdict, String verdictReason) {

    public EvaluationOutcome {
        results = List.copyOf(results);
        Objects.requireNonNull(verdict, "verdict");
        Objects.requireNonNull(verdictReason, "verdictReason");
    }
}
