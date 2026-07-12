package com.treyi.suitabilitygate.suitability;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * A supervisor's mandatory human decision on a decision record — a separate, appended, immutable event
 * (brief §6.1, D11). Humans are always in the loop: EVERY decision (PASS or FLAGGED) requires one of these
 * before it is final — {@link OverrideStatus#APPROVED} (proceed) or {@link OverrideStatus#REJECTED} (block).
 *
 * <p><b>Append-only by construction (the tamper-evidence claim):</b> the frozen {@link DecisionRecord} is
 * NEVER mutated by a review. This event is stored in its own side table and stitched into the record's
 * {@code overrides} on read — the identical insert-once-side-record pattern the async explanation uses.
 * History only grows.
 *
 * <p><b>Identity from the token:</b> {@code overriddenBy} is the supervisor's verified JWT identity, set
 * server-side — never trusted from the request body (which carries only {@code action} + {@code justification}).
 *
 * @param overrideId      stable unique id for this review event
 * @param recordId        the {@link DecisionRecord} that was reviewed
 * @param createdAt       when the review was recorded
 * @param overriddenBy    the supervisor's identity, from the verified JWT
 * @param justification   the supervisor's mandatory, non-blank rationale
 * @param resultingStatus the outcome ({@link OverrideStatus#APPROVED} or {@link OverrideStatus#REJECTED})
 */
public record OverrideEvent(
        UUID overrideId,
        UUID recordId,
        Instant createdAt,
        String overriddenBy,
        String justification,
        OverrideStatus resultingStatus) {

    public OverrideEvent {
        Objects.requireNonNull(overrideId, "overrideId");
        Objects.requireNonNull(recordId, "recordId");
        Objects.requireNonNull(createdAt, "createdAt");
        Objects.requireNonNull(overriddenBy, "overriddenBy");
        Objects.requireNonNull(resultingStatus, "resultingStatus");
        if (justification == null || justification.isBlank()) {
            throw new IllegalArgumentException("justification is mandatory and must be non-blank");
        }
    }
}
