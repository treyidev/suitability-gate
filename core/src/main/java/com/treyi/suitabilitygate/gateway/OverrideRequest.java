package com.treyi.suitabilitygate.gateway;

import java.util.Objects;

import com.treyi.suitabilitygate.suitability.OverrideStatus;

/**
 * The body of {@code POST /evaluations/{id}/override} — a supervisor's human decision on a decision record.
 *
 * <p>The brief's body is {@code {justification}}; we add {@code action} so the supervisor can approve or
 * reject the transaction (both logged). The supervisor's identity is NOT here — it comes from the verified
 * JWT server-side (never trusted from the body).
 *
 * <p>Validated in the compact constructor: a null {@code action} or a blank {@code justification} throws,
 * which Spring surfaces as a 400 (the same message-not-readable path {@code ProposedTransaction} uses).
 *
 * @param action        the decision outcome ({@link OverrideStatus#APPROVED} or {@link OverrideStatus#REJECTED})
 * @param justification the supervisor's mandatory, non-blank rationale
 */
public record OverrideRequest(OverrideStatus action, String justification) {

    public OverrideRequest {
        Objects.requireNonNull(action, "action");
        if (justification == null || justification.isBlank()) {
            throw new IllegalArgumentException("justification is mandatory and must be non-blank");
        }
    }
}
