package com.treyi.suitabilitygate.gateway;

import java.util.List;

import com.treyi.suitabilitygate.suitability.EvaluationOutcome;
import com.treyi.suitabilitygate.suitability.RuleResult;
import com.treyi.suitabilitygate.suitability.Verdict;

/**
 * Wire response for {@code POST /evaluations/preview} — a non-persisted verdict preview the RM reviews
 * before committing.
 *
 * <p><b>Deliberately not a {@link com.treyi.suitabilitygate.suitability.DecisionRecord}:</b> a preview is
 * a what-if, not the audit artifact, so it honestly carries only the verdict, its reason, and the rule
 * results — no certificate number, no provenance stamp, no AI explanation, no supervisor-approval slot.
 * Those exist only on a committed record (minted by {@code POST /evaluations} on Submit). Field name
 * {@code ruleResults} mirrors the record so the frontend renders both with the same row component.
 *
 * @param verdict       the composed verdict — provably identical to the record a later Submit commits
 * @param verdictReason the one-sentence reason composed from blocking failures
 * @param ruleResults   every rule result produced (order preserved)
 */
public record EvaluationPreview(Verdict verdict, String verdictReason, List<RuleResult> ruleResults) {

    /** Project an engine outcome into the preview wire shape. */
    static EvaluationPreview from(EvaluationOutcome outcome) {
        return new EvaluationPreview(outcome.verdict(), outcome.verdictReason(), outcome.results());
    }
}
