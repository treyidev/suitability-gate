package com.treyi.suitabilitygate.customerdata;

import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * A customer's current portfolio — the capability-gated companion to {@link CustomerProfile}.
 *
 * <p><b>Capability-gated:</b> not every source can supply holdings. When the capability is absent the
 * snapshot is null and holdings-dependent rules record SKIPPED (auditable), rather than the pipeline
 * failing. When present, a full copy is embedded in the DecisionRecord alongside the profile.
 *
 * @param customerId   owner of the portfolio
 * @param asOf         valuation date of this snapshot
 * @param positions    individual holdings; defensively copied to an immutable list
 * @param totalValueInr total portfolio value in INR
 */
public record Holdings(
        UUID customerId,
        LocalDate asOf,
        List<Position> positions,
        long totalValueInr) {

    /** Fail-fast on required fields; {@code positions} is copied to an unmodifiable list (also null-checks it). */
    public Holdings {
        Objects.requireNonNull(customerId, "customerId");
        Objects.requireNonNull(asOf, "asOf");
        positions = List.copyOf(positions);
    }
}
