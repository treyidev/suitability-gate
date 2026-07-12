package com.treyi.suitabilitygate.suitability;

import java.util.UUID;

/**
 * A referenced customer or scheme was not found while evaluating a proposal. Maps to HTTP 404.
 *
 * <p>Fail-fast: the pipeline never proceeds on a missing customer/scheme, so a decision is never made
 * against incomplete inputs.
 */
public class ResourceNotFoundException extends EvaluationException {

    public ResourceNotFoundException(String message) {
        super(message);
    }

    /** Customer id could not be resolved by the customer directory. */
    public static ResourceNotFoundException customer(UUID customerId) {
        return new ResourceNotFoundException("No customer found with id: " + customerId);
    }

    /** Scheme id could not be resolved by the scheme catalog. */
    public static ResourceNotFoundException scheme(UUID schemeId) {
        return new ResourceNotFoundException("No scheme found with id: " + schemeId);
    }

    /** Decision record id could not be resolved by the ledger. */
    public static ResourceNotFoundException record(UUID recordId) {
        return new ResourceNotFoundException("No decision record found with id: " + recordId);
    }
}
