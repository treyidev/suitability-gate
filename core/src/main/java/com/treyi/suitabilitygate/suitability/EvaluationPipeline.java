package com.treyi.suitabilitygate.suitability;

import java.time.Instant;
import java.time.ZoneId;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.TimeUnit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;

import com.treyi.suitabilitygate.customerdata.CustomerDirectory;
import com.treyi.suitabilitygate.customerdata.CustomerProfile;
import com.treyi.suitabilitygate.schemecatalog.Scheme;
import com.treyi.suitabilitygate.schemecatalog.SchemeCatalog;
import com.treyi.suitabilitygate.suitability.ruleset.Ruleset;

/**
 * The single orchestrator — the one component with business logic (brief §3.1). Runs the staged
 * pipeline (§3.3) for a proposed transaction and returns the frozen {@link DecisionRecord}.
 *
 * <pre>
 *   [1] resolve customer   (CustomerDirectory)      → snapshot
 *   [2] resolve scheme      (SchemeCatalog)          → snapshot
 *   [3] evaluate            (SuitabilityEvaluator)   → rule results + verdict   ← the decision
 *   [4] record              (DecisionLedger)         → freeze + append
 * </pre>
 *
 * <p>Stage 5 (Explain) is downstream and async — deliberately NOT here, so verdict latency stays at
 * rules-engine latency. The measured latency (stages 1–3) is stamped into provenance and logged as the
 * decision-summary INFO line (per CLAUDE.md §5); per-stage detail logs at DEBUG.
 *
 * <p>Design note: the brief phrases stages as a mutable shared context; this implementation accumulates
 * into immutable values through private stage methods instead (immutability + debuggability). Adding a
 * capability today means a new private stage + a new field on the draft; formalising into registered
 * {@code PipelineStage} beans is a Phase-2 refinement. There must remain exactly ONE orchestrator.
 */
@Service
public class EvaluationPipeline {

    private static final Logger log = LoggerFactory.getLogger(EvaluationPipeline.class);
    private static final String ENGINE_VERSION = "1.0.0";

    /**
     * MDC key for the correlation id, captured into the published event so the async explanation
     * handler can restore it on its thread (§5). Deliberately a local duplicate of the gateway's
     * {@code CorrelationIdFilter.EVAL_ID_KEY}: importing it would invert the module dependency
     * (gateway → suitability, never the reverse). The logback pattern {@code %X{evalId}} is the
     * shared contract both constants must match.
     */
    private static final String EVAL_ID_MDC_KEY = "evalId";

    private final CustomerDirectory customers;
    private final SchemeCatalog schemes;
    private final SuitabilityEvaluator evaluator;
    private final DecisionLedger ledger;
    private final Ruleset ruleset;
    private final ApplicationEventPublisher events;

    public EvaluationPipeline(CustomerDirectory customers, SchemeCatalog schemes,
            SuitabilityEvaluator evaluator, DecisionLedger ledger, Ruleset ruleset,
            ApplicationEventPublisher events) {
        this.customers = customers;
        this.schemes = schemes;
        this.evaluator = evaluator;
        this.ledger = ledger;
        this.ruleset = ruleset;
        this.events = events;
    }

    /**
     * Evaluate a proposed transaction end to end and return the frozen decision record.
     *
     * @param proposal the RM's proposed transaction
     * @return the immutable, recorded decision
     * @throws ResourceNotFoundException if the customer or scheme cannot be resolved
     */
    public DecisionRecord evaluate(ProposedTransaction proposal) {
        Instant evaluatedAt = Instant.now();
        LocalDate asOf = LocalDate.ofInstant(evaluatedAt, ZoneId.systemDefault());
        long startNanos = System.nanoTime();

        CustomerProfile customer = resolveCustomer(proposal, asOf);          // stage 1
        Scheme scheme = resolveScheme(proposal);                            // stage 2
        EvaluationContext context = new EvaluationContext(customer, scheme, proposal, evaluatedAt);
        EvaluationOutcome outcome = evaluator.evaluate(context);            // stage 3

        long evaluationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);
        DecisionDraft draft = buildDraft(proposal, customer, scheme, outcome, evaluationMs);
        DecisionRecord record = ledger.record(draft);                      // stage 4
        publishRecorded(record);                                           // → stage 5, async

        log.info("Decision {} verdict={} rules={} evaluatedInMs={} ruleset={}",
                record.certificateNumber(), record.verdict(), outcome.results().size(),
                evaluationMs, ruleset.version());
        return record;
    }

    /**
     * Screen a proposed transaction WITHOUT recording it — a read-only "what-if" probe used by the RM's
     * plan suggestion and the pre-submit preview. Runs stages 1–3 only (resolve customer, resolve scheme,
     * evaluate) and returns the outcome; it deliberately does NOT freeze a record, assign a certificate,
     * persist to the ledger, or publish the explanation event.
     *
     * <p><b>Why it is safe to preview then commit:</b> the rules are deterministic and read only from the
     * resolved context, so the outcome here is identical to what {@link #evaluate} would freeze for the
     * same proposal. A preview verdict therefore provably matches the record a later Submit commits — the
     * one-and-only writer of the ledger remains {@link #evaluate}.
     *
     * @param proposal the proposed transaction to screen
     * @return the rule results + composed verdict (never null); nothing is persisted
     * @throws ResourceNotFoundException if the customer or scheme cannot be resolved
     */
    public EvaluationOutcome screen(ProposedTransaction proposal) {
        Instant evaluatedAt = Instant.now();
        LocalDate asOf = LocalDate.ofInstant(evaluatedAt, ZoneId.systemDefault());
        CustomerProfile customer = resolveCustomer(proposal, asOf);
        Scheme scheme = resolveScheme(proposal);
        EvaluationContext context = new EvaluationContext(customer, scheme, proposal, evaluatedAt);
        return evaluator.evaluate(context);
    }

    /**
     * Publish {@link DecisionRecordedEvent} — the hand-off to the async explanation seam (stage 5,
     * D6). Fire-and-forget: the verdict is already frozen and returned regardless of what any
     * downstream listener does. Carries only ids/verdict/failed-rule ids (PII discipline, §5) plus
     * the MDC correlation id so the handler's thread can restore the trace.
     */
    private void publishRecorded(DecisionRecord record) {
        List<String> failedRuleIds = record.ruleResults().stream()
                .filter(result -> result.outcome() == Outcome.FAIL)
                .map(RuleResult::ruleId)
                .toList();
        events.publishEvent(new DecisionRecordedEvent(record.recordId(), record.certificateNumber(),
                record.verdict(), failedRuleIds, MDC.get(EVAL_ID_MDC_KEY)));
    }

    private CustomerProfile resolveCustomer(ProposedTransaction proposal, LocalDate asOf) {
        CustomerProfile customer = customers.findProfile(proposal.customerId(), asOf)
                .orElseThrow(() -> ResourceNotFoundException.customer(proposal.customerId()));
        log.debug("Resolved customer {} (age {})", customer.customerId(), customer.ageYears());
        return customer;
    }

    private Scheme resolveScheme(ProposedTransaction proposal) {
        Scheme scheme = schemes.findById(proposal.schemeId())
                .orElseThrow(() -> ResourceNotFoundException.scheme(proposal.schemeId()));
        log.debug("Resolved scheme {} ({})", scheme.schemeCode(), scheme.riskometerLevel());
        return scheme;
    }

    private DecisionDraft buildDraft(ProposedTransaction proposal, CustomerProfile customer,
            Scheme scheme, EvaluationOutcome outcome, long evaluationMs) {
        Provenance provenance = new Provenance(
                customer.sourceSystem(), ENGINE_VERSION, ruleset.version(), evaluationMs,
                new Provenance.Capabilities(false));   // holdings capability absent in Phase 1
        return new DecisionDraft(proposal, customer, null, scheme, outcome.results(),
                outcome.verdict(), outcome.verdictReason(), AiContribution.pending(), provenance);
    }
}
