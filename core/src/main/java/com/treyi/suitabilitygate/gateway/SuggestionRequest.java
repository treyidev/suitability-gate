package com.treyi.suitabilitygate.gateway;

import java.util.Objects;
import java.util.UUID;

/**
 * The plan-suggestion request body for {@code POST /suggestions}. Carries only the customer to propose
 * for; the RM identity (used to form the ephemeral, non-persisted screening proposals) comes from the
 * authenticated token, not the body — consistent with {@link EvaluationRequest}.
 *
 * @param customerId the customer to suggest a plan for
 */
public record SuggestionRequest(UUID customerId) {

    public SuggestionRequest {
        Objects.requireNonNull(customerId, "customerId");
    }
}
