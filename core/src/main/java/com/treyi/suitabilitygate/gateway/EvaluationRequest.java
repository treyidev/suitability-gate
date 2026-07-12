package com.treyi.suitabilitygate.gateway;

import java.util.Objects;
import java.util.UUID;

import com.treyi.suitabilitygate.suitability.TransactionType;

/**
 * The evaluation request body. Deliberately omits {@code rmId} and {@code branchCode}: those are taken
 * from the authenticated caller's token, not trusted from the client — the identity that flows into the
 * audit record is the one that logged in.
 *
 * @param customerId      customer the sale is proposed for
 * @param schemeId        scheme being proposed
 * @param amountInr       proposed amount in INR (must be positive)
 * @param transactionType lumpsum or SIP
 */
public record EvaluationRequest(
        UUID customerId,
        UUID schemeId,
        long amountInr,
        TransactionType transactionType) {

    public EvaluationRequest {
        Objects.requireNonNull(customerId, "customerId");
        Objects.requireNonNull(schemeId, "schemeId");
        Objects.requireNonNull(transactionType, "transactionType");
        if (amountInr <= 0) {
            throw new IllegalArgumentException("amountInr must be > 0, was " + amountInr);
        }
    }
}
