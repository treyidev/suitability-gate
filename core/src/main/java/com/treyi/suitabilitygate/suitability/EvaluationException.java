package com.treyi.suitabilitygate.suitability;

/**
 * Base type for failures raised while evaluating a proposed transaction.
 *
 * <p>Domain-specific (not a bare {@code RuntimeException}) so the gateway can map subtypes to the right
 * RFC-7807 problem responses (e.g. {@link ResourceNotFoundException} → 404) rather than a blanket 500.
 */
public class EvaluationException extends RuntimeException {

    public EvaluationException(String message) {
        super(message);
    }
}
