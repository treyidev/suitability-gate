package com.treyi.suitabilitygate.explanation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;

import com.treyi.suitabilitygate.explanation.ExplanationProvider.Explanation;
import com.treyi.suitabilitygate.suitability.DecisionLedger;
import com.treyi.suitabilitygate.suitability.DecisionRecordedEvent;

/**
 * The async stage-5 worker: consumes {@link DecisionRecordedEvent}, obtains prose from the
 * {@link ExplanationProvider}, and attaches it via the ledger port.
 *
 * <p><b>Failure policy (fail-soft, deliberately):</b> the verdict is already frozen and returned;
 * an explanation failure must never surface to the evaluation path. On any provider error the record
 * is marked {@code FAILED} and the error logged at WARN — this is the one place in the system where
 * swallowing an exception is correct behaviour, because the alternative (retry loops, dead letters)
 * is Phase-2 hardening alongside the durable event registry (see module docs).
 *
 * <p><b>Correlation (§5):</b> MDC does not propagate to {@code @Async} threads, so the handler
 * restores {@code evalId} from the event and clears it in {@code finally} — one evaluation's log
 * lines share the id across both threads.
 */
@Component
class DecisionExplanationHandler {

    private static final Logger log = LoggerFactory.getLogger(DecisionExplanationHandler.class);

    /** Must match the logback pattern token {@code %X{evalId}} (same contract as the gateway filter). */
    private static final String EVAL_ID_MDC_KEY = "evalId";

    private final ExplanationProvider provider;
    private final DecisionLedger ledger;

    DecisionExplanationHandler(ExplanationProvider provider, DecisionLedger ledger) {
        this.provider = provider;
        this.ledger = ledger;
    }

    /**
     * React to a frozen decision: render + attach its explanation, or mark the attempt failed.
     *
     * <p>Plain {@code @Async @EventListener} (in-memory, at-most-once) is the Phase-1 delivery
     * choice — see the module docs for why and for the Phase-2 durable upgrade path.
     *
     * @param event the frozen decision's facts (ids, verdict, failed rule ids, correlation id)
     */
    @Async
    @EventListener
    public void onDecisionRecorded(DecisionRecordedEvent event) {
        if (event.evalId() != null) {
            MDC.put(EVAL_ID_MDC_KEY, event.evalId());
        }
        try {
            Explanation explanation = provider.explain(
                    event.certificateNumber(), event.verdict(), event.failedRuleIds());
            ledger.attachExplanation(event.recordId(), explanation.provider(), explanation.text());
            log.info("Explanation attached to {} provider={}", event.certificateNumber(),
                    explanation.provider());
        } catch (RuntimeException ex) {
            // Fail-soft by design: the decision stands; only the prose is absent (see class docs).
            log.warn("Explanation FAILED for {}: {}", event.certificateNumber(), ex.getMessage());
            markFailedQuietly(event);
        } finally {
            MDC.remove(EVAL_ID_MDC_KEY);
        }
    }

    /** Marking FAILED must itself never throw into the async executor — last-resort guard. */
    private void markFailedQuietly(DecisionRecordedEvent event) {
        try {
            ledger.markExplanationFailed(event.recordId());
        } catch (RuntimeException ex) {
            log.error("Could not mark explanation FAILED for {}", event.certificateNumber(), ex);
        }
    }
}
