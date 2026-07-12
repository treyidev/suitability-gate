package com.treyi.suitabilitygate.suitability;

import java.util.Objects;
import java.util.UUID;

/**
 * An AI-assisted plan suggestion for a customer — the RM co-pilot's proposed draft (a {@code scheme +
 * amount + type}) plus a plain-language rationale.
 *
 * <p><b>Where it fits (the thesis, upheld):</b> this is an <em>input</em>, never a decision. It carries
 * NO verdict of record — it is exactly what an RM would otherwise type into the proposal form by hand.
 * A human accepts (or edits, or rejects) it, and only then does the deterministic gate adjudicate the
 * verdict on Submit. The suggestion is produced downstream of nothing and authoritative over nothing:
 * <em>AI proposes · human accepts · code decides · human approves.</em>
 *
 * <p><b>Phase 1 vs Phase 2:</b> the Phase-1 {@code PlanProposer} that builds this is a rules-aware
 * deterministic stub (honestly labelled "AI-assisted"); a live model drops in behind the same interface
 * in Phase 2 with no change to this contract. Either way the plan is only ever <em>likely</em> to pass —
 * the gate on Submit is the sole authority, and the RM can edit the draft into anything, which the gate
 * still catches.
 *
 * @param schemeId        the suggested scheme's canonical id (populates the proposal's scheme picker)
 * @param schemeName      the suggested scheme's display name (self-contained payload; also cited in the rationale)
 * @param amountInr       the suggested amount in INR — a whole lumpsum, or one monthly SIP instalment (sized from annual income, floored at the scheme minimum)
 * @param transactionType the suggested transaction shape (lumpsum or SIP)
 * @param rationale       a plain-language, RM-facing sentence explaining why this plan fits and clears the gate
 */
public record ProposedPlan(
        UUID schemeId,
        String schemeName,
        long amountInr,
        TransactionType transactionType,
        String rationale) {

    public ProposedPlan {
        Objects.requireNonNull(schemeId, "schemeId");
        Objects.requireNonNull(schemeName, "schemeName");
        Objects.requireNonNull(transactionType, "transactionType");
        Objects.requireNonNull(rationale, "rationale");
        if (amountInr <= 0) {
            throw new IllegalArgumentException("amountInr must be > 0, was " + amountInr);
        }
        if (rationale.isBlank()) {
            throw new IllegalArgumentException("rationale must not be blank");
        }
    }
}
