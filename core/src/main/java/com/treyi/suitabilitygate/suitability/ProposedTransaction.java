package com.treyi.suitabilitygate.suitability;

import java.util.Objects;
import java.util.UUID;

/**
 * The RM's proposed mutual-fund purchase — the input that enters the evaluation pipeline.
 *
 * <p>Identifies the customer and scheme by canonical id (the pipeline resolves the full snapshots in
 * stages 1–2). {@code rmId} and {@code branchCode} originate from the authenticated RM's JWT and flow
 * into the DecisionRecord for the audit story.
 *
 * @param customerId      customer the sale is proposed for
 * @param schemeId        scheme being proposed
 * @param amountInr       proposed amount in INR (must be positive)
 * @param transactionType lumpsum or SIP
 * @param rmId            relationship manager id, from the JWT
 * @param branchCode      branch the RM is acting from
 */
public record ProposedTransaction(
        UUID customerId,
        UUID schemeId,
        long amountInr,
        TransactionType transactionType,
        String rmId,
        String branchCode) {

    public ProposedTransaction {
        Objects.requireNonNull(customerId, "customerId");
        Objects.requireNonNull(schemeId, "schemeId");
        Objects.requireNonNull(transactionType, "transactionType");
        Objects.requireNonNull(rmId, "rmId");
        Objects.requireNonNull(branchCode, "branchCode");
        if (amountInr <= 0) {
            throw new IllegalArgumentException("amountInr must be > 0, was " + amountInr);
        }
    }
}
