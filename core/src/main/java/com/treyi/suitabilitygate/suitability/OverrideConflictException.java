package com.treyi.suitabilitygate.suitability;

import java.util.UUID;

/**
 * A FLAGGED decision has already been reviewed and a second review was attempted. Maps to HTTP 409.
 *
 * <p>Phase-1 policy is one review per record (first wins) — a recorded decision is never re-litigated.
 * The storage itself is append-only events (multiple rows are possible by construction); this exception
 * enforces the single-review policy at the write boundary. Phase 2 may relax it to a full review history.
 */
public class OverrideConflictException extends RuntimeException {

    public OverrideConflictException(UUID recordId) {
        super("Decision " + recordId + " has already been reviewed; it cannot be reviewed again.");
    }
}
