package com.treyi.suitabilitygate.suitability;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

import com.treyi.suitabilitygate.customerdata.CustomerProfile;
import com.treyi.suitabilitygate.customerdata.Holdings;
import com.treyi.suitabilitygate.schemecatalog.Scheme;

/**
 * THE artifact — the immutable, append-only record of a single suitability decision (brief §6).
 *
 * <p><b>Why it lives here (in {@code suitability}, not {@code decisionrecord}):</b> per brief §3.3 the
 * context accumulated through pipeline stages 1–4 IS the DecisionRecord — it is the pipeline's product.
 * The {@code decisionrecord} module owns its <em>persistence</em> (the ledger/DB), implementing the
 * {@link DecisionLedger} port; this keeps the dependency acyclic and the domain type at the centre
 * (hexagonal: persistence depends on the domain, not vice versa).
 *
 * <p><b>Full-snapshot embedding (D12):</b> complete copies of the profile, holdings, and scheme are
 * embedded so a decision can be replayed exactly as made — no joins on read, perfect "what did you know
 * then". The record is never mutated; overrides and the async explanation are appended/attached, not
 * edited in place.
 *
 * @param recordId         stable unique id
 * @param certificateNumber human-readable certificate number ({@code SG-YYYY-NNNNNN})
 * @param createdAt        when the record was frozen
 * @param proposal         the proposed transaction that was evaluated
 * @param customerSnapshot full customer profile as of evaluation
 * @param holdingsSnapshot full holdings as of evaluation, or null if the capability was absent
 * @param schemeSnapshot   full scheme as of evaluation
 * @param ruleResults      every rule result produced (order preserved)
 * @param verdict          the composed verdict
 * @param verdictReason    one-sentence reason composed from blocking failures
 * @param aiContribution   the AI-contribution statement + async explanation state
 * @param provenance       how/with-what the decision was judged
 * @param overrides        supervisor reviews (brief §6.1 OverrideEvents) stitched onto the record on read —
 *                         empty until reviewed. The frozen record is never mutated; a review is a separate
 *                         appended event, so this list grows only via the ledger's overlay, never in place.
 */
public record DecisionRecord(
        UUID recordId,
        String certificateNumber,
        Instant createdAt,
        ProposedTransaction proposal,
        CustomerProfile customerSnapshot,
        Holdings holdingsSnapshot,
        Scheme schemeSnapshot,
        List<RuleResult> ruleResults,
        Verdict verdict,
        String verdictReason,
        AiContribution aiContribution,
        Provenance provenance,
        List<OverrideEvent> overrides) {

    public DecisionRecord {
        Objects.requireNonNull(recordId, "recordId");
        Objects.requireNonNull(certificateNumber, "certificateNumber");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(proposal, "proposal");
        Objects.requireNonNull(customerSnapshot, "customerSnapshot");
        Objects.requireNonNull(schemeSnapshot, "schemeSnapshot");
        Objects.requireNonNull(verdict, "verdict");
        Objects.requireNonNull(verdictReason, "verdictReason");
        Objects.requireNonNull(aiContribution, "aiContribution");
        Objects.requireNonNull(provenance, "provenance");
        ruleResults = List.copyOf(ruleResults);
        // Null-safe: decision_records JSON payloads written before overrides existed deserialize with a
        // null here; they carry no reviews, so an empty list is correct. New records also start empty and
        // gain reviews only via the ledger's on-read stitch (never stored in the frozen payload).
        overrides = overrides == null ? List.of() : List.copyOf(overrides);
    }
}
