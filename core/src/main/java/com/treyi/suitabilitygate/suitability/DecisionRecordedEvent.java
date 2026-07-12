package com.treyi.suitabilitygate.suitability;

import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Published the moment a decision has been frozen and appended to the ledger — THE one async seam
 * (locked decision D6): verdict upstream, explanation downstream, never the reverse.
 *
 * <p>Deliberately carries only the facts the explanation needs (ids + verdict + failed rule ids),
 * not the whole record: the payload crosses an async boundary and (via the explanation module) a
 * process boundary, so it follows the same PII discipline as logs (§5) — ids only, no customer data.
 *
 * <p>{@code evalId} is the operational correlation id captured from MDC at publish time, so the async
 * handler can restore it on its own thread and the end-to-end trace stays unbroken (§5 async-seam
 * intent).
 *
 * @param recordId          the frozen record's id (the attach-back key)
 * @param certificateNumber human-readable certificate number (for logs/correlation downstream)
 * @param verdict           the composed verdict
 * @param failedRuleIds     ids of rules whose outcome was FAIL (empty for a clean PASS)
 * @param evalId            correlation id from the originating request, or null if none was set
 */
public record DecisionRecordedEvent(
        UUID recordId,
        String certificateNumber,
        Verdict verdict,
        List<String> failedRuleIds,
        String evalId) {

    public DecisionRecordedEvent {
        Objects.requireNonNull(recordId, "recordId");
        Objects.requireNonNull(certificateNumber, "certificateNumber");
        Objects.requireNonNull(verdict, "verdict");
        failedRuleIds = List.copyOf(failedRuleIds);
    }
}
