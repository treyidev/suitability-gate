package com.treyi.suitabilitygate.suitability;

import java.util.List;
import java.util.Objects;

import com.treyi.suitabilitygate.customerdata.CustomerProfile;
import com.treyi.suitabilitygate.customerdata.Holdings;
import com.treyi.suitabilitygate.schemecatalog.Scheme;

/**
 * Everything the pipeline computes for a decision EXCEPT the ledger-assigned identity.
 *
 * <p>The orchestrator builds this and hands it to {@link DecisionLedger#record(DecisionDraft)}; the
 * ledger assigns {@code recordId}, {@code certificateNumber}, and {@code createdAt} and returns the
 * frozen {@link DecisionRecord}. Keeping identity assignment with the ledger makes it the single
 * authority for the certificate sequence and record creation (the "sole writer" story).
 *
 * @param proposal         the proposed transaction evaluated
 * @param customerSnapshot full customer profile as of evaluation
 * @param holdingsSnapshot full holdings, or null if capability absent
 * @param schemeSnapshot   full scheme as of evaluation
 * @param ruleResults      the rule results produced
 * @param verdict          the composed verdict
 * @param verdictReason    one-sentence reason
 * @param aiContribution   the AI-contribution statement (explanation PENDING at this point)
 * @param provenance       decision provenance
 */
public record DecisionDraft(
        ProposedTransaction proposal,
        CustomerProfile customerSnapshot,
        Holdings holdingsSnapshot,
        Scheme schemeSnapshot,
        List<RuleResult> ruleResults,
        Verdict verdict,
        String verdictReason,
        AiContribution aiContribution,
        Provenance provenance) {

    public DecisionDraft {
        Objects.requireNonNull(proposal, "proposal");
        Objects.requireNonNull(customerSnapshot, "customerSnapshot");
        Objects.requireNonNull(schemeSnapshot, "schemeSnapshot");
        Objects.requireNonNull(verdict, "verdict");
        Objects.requireNonNull(verdictReason, "verdictReason");
        Objects.requireNonNull(aiContribution, "aiContribution");
        Objects.requireNonNull(provenance, "provenance");
        ruleResults = List.copyOf(ruleResults);
    }
}
