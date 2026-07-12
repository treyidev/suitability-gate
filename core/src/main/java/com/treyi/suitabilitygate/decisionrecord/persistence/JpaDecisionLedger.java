package com.treyi.suitabilitygate.decisionrecord.persistence;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.treyi.suitabilitygate.suitability.AiContribution;
import com.treyi.suitabilitygate.suitability.DecisionDraft;
import com.treyi.suitabilitygate.suitability.DecisionLedger;
import com.treyi.suitabilitygate.suitability.DecisionRecord;
import com.treyi.suitabilitygate.suitability.ExplanationStatus;
import com.treyi.suitabilitygate.suitability.OverrideConflictException;
import com.treyi.suitabilitygate.suitability.OverrideEvent;
import com.treyi.suitabilitygate.suitability.OverrideStatus;
import com.treyi.suitabilitygate.suitability.ResourceNotFoundException;

/**
 * H2/Postgres-backed {@link DecisionLedger} — the real, persistent implementation.
 *
 * <p>This is the payoff of the DIP seam (option A): swapping the provisional in-memory ledger for this
 * one touched neither the {@link DecisionLedger} port nor the pipeline. It assigns the record identity
 * (id, sequence-backed certificate number, timestamp), serialises the frozen record to a JSON document,
 * and appends a row. Records now survive restarts.
 *
 * <p>Append-only: only inserts and reads happen here; there is no update or delete path. Two things attach
 * to a decision without ever UPDATEing its row — both insert-once side records overlaid on read: the async
 * explanation ({@code decision_explanations} → {@code aiContribution}, {@link #findById}) and a supervisor
 * review ({@code decision_overrides} → {@code overrides}, brief §6.1). The frozen decision itself is never
 * rewritten — that is the tamper-evidence claim an auditor checks.
 */
@Component
class JpaDecisionLedger implements DecisionLedger {

    private static final Logger log = LoggerFactory.getLogger(JpaDecisionLedger.class);

    private final DecisionRecordRepository repository;
    private final DecisionExplanationRepository explanations;
    private final DecisionOverrideRepository overrides;
    private final ObjectMapper objectMapper;

    JpaDecisionLedger(DecisionRecordRepository repository, DecisionExplanationRepository explanations,
            DecisionOverrideRepository overrides, ObjectMapper objectMapper) {
        this.repository = repository;
        this.explanations = explanations;
        this.overrides = overrides;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public DecisionRecord record(DecisionDraft draft) {
        long sequence = repository.nextCertificateSequence();
        UUID recordId = UUID.randomUUID();
        Instant createdAt = Instant.now();
        String certificateNumber = "SG-%d-%06d"
                .formatted(createdAt.atZone(ZoneOffset.UTC).getYear(), sequence);

        DecisionRecord record = new DecisionRecord(recordId, certificateNumber, createdAt,
                draft.proposal(), draft.customerSnapshot(), draft.holdingsSnapshot(),
                draft.schemeSnapshot(), draft.ruleResults(), draft.verdict(), draft.verdictReason(),
                draft.aiContribution(), draft.provenance(), List.of());

        DecisionRecordEntity entity = new DecisionRecordEntity(recordId, certificateNumber,
                draft.proposal().branchCode(), draft.proposal().rmId(), record.verdict().name(),
                createdAt, serialize(record));
        repository.save(entity);

        log.info("Appended decision {} certificate={} verdict={}",
                recordId, certificateNumber, record.verdict());
        return record;
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<DecisionRecord> findById(UUID recordId) {
        return repository.findById(recordId)
                .map(entity -> deserialize(entity.getPayload()))
                .map(this::overlayExplanation)
                .map(this::overlayOverrides);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DecisionRecord> findAll() {
        // No explanation overlay here (see DecisionLedger#findAll): the dashboard needs verdicts/rules/
        // metadata, not the async prose. Reviews (overrides) ARE overlaid — the dashboard shows a
        // reviewed status — but batched in ONE query (grouped by record id), not the per-row N+1 the
        // explanation overlay would incur.
        Map<UUID, List<OverrideEvent>> overridesByRecord = overrides.findAll().stream()
                .map(this::toOverrideEvent)
                .collect(Collectors.groupingBy(OverrideEvent::recordId));
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .map(entity -> deserialize(entity.getPayload()))
                .map(record -> withOverrides(record,
                        overridesByRecord.getOrDefault(record.recordId(), List.of())))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DecisionRecord> findByCustomerId(UUID customerId) {
        // Filter in the app, not in SQL: the customerId lives inside the record's JSON payload
        // (customerSnapshot.customerId), NOT in an indexed column — the ledger's columns are the ones
        // compliance filters on (branch/rm/verdict/createdAt), and the schema is Flyway-owned with
        // ddl-auto=validate, so adding a customer_id column/index is a migration, out of scope here. One
        // customer's slice is small, so a full newest-first scan + in-memory filter is an acceptable cost;
        // if this ever needs to scale, promoting customerId to a column+index is the isolated upgrade.
        // Explanation AND review overlays are attached per DecisionLedger#findByCustomerId (the prose is the
        // customer-facing "why"); the slice is small so the per-record overlay is bounded, unlike findAll.
        return repository.findAllByOrderByCreatedAtDesc().stream()
                .map(entity -> deserialize(entity.getPayload()))
                .filter(record -> customerId.equals(record.customerSnapshot().customerId()))
                .map(this::overlayExplanation)
                .map(this::overlayOverrides)
                .toList();
    }

    @Override
    @Transactional
    public void attachExplanation(UUID recordId, String provider, String explanationText) {
        if (explanations.existsById(recordId)) {
            // First attach wins (insert-once): a redelivered event must not rewrite history.
            log.debug("Explanation already present for {}; ignoring re-attach", recordId);
            return;
        }
        explanations.save(new DecisionExplanationEntity(recordId, ExplanationStatus.ATTACHED.name(),
                provider, explanationText, Instant.now()));
        log.info("Attached explanation to {} provider={}", recordId, provider);
    }

    @Override
    @Transactional
    public void markExplanationFailed(UUID recordId) {
        if (explanations.existsById(recordId)) {
            log.debug("Explanation outcome already present for {}; ignoring FAILED mark", recordId);
            return;
        }
        explanations.save(new DecisionExplanationEntity(recordId, ExplanationStatus.FAILED.name(),
                null, null, Instant.now()));
        log.info("Marked explanation FAILED for {}", recordId);
    }

    @Override
    @Transactional
    public OverrideEvent attachOverride(UUID recordId, OverrideStatus resultingStatus, String justification,
            String overriddenBy) {
        // Humans always in the loop: EVERY decision (PASS or FLAGGED) may be approved/rejected — no verdict
        // gate. Only the record must exist (404) and not already be decided (409, first-wins).
        if (!repository.existsById(recordId)) {
            throw ResourceNotFoundException.record(recordId);
        }
        if (overrides.existsByRecordId(recordId)) {
            // One human decision per record (first wins) — append-only history is not re-litigated.
            throw new OverrideConflictException(recordId);
        }
        OverrideEvent event = new OverrideEvent(UUID.randomUUID(), recordId, Instant.now(), overriddenBy,
                justification, resultingStatus);
        overrides.save(new DecisionOverrideEntity(event.overrideId(), event.recordId(), event.createdAt(),
                event.overriddenBy(), event.justification(), event.resultingStatus().name()));
        log.info("Recorded human decision {} for {} outcome={} by={}",
                event.overrideId(), recordId, resultingStatus, overriddenBy);
        return event;
    }

    /**
     * Overlay the explanation attachment (if one exists) into the frozen record's
     * {@code aiContribution}. The stored payload keeps its original PENDING state forever — the
     * overlay happens only on the returned value, so what-was-known-at-decision-time stays intact
     * in storage while readers see the current explanation lifecycle.
     */
    private DecisionRecord overlayExplanation(DecisionRecord record) {
        return explanations.findById(record.recordId())
                .map(explanation -> withAiContribution(record, toAiContribution(explanation)))
                .orElse(record);
    }

    /**
     * Stitch the record's supervisor reviews (if any) into its {@code overrides} on read (brief §6.1, D11).
     * Like the explanation overlay, the frozen record is never mutated — the reviews live in their own
     * append-only table and are attached only to the returned value.
     */
    private DecisionRecord overlayOverrides(DecisionRecord record) {
        List<OverrideEvent> events = overrides.findByRecordId(record.recordId()).stream()
                .map(this::toOverrideEvent)
                .toList();
        return events.isEmpty() ? record : withOverrides(record, events);
    }

    private AiContribution toAiContribution(DecisionExplanationEntity explanation) {
        if (ExplanationStatus.ATTACHED.name().equals(explanation.getStatus())) {
            return AiContribution.attached(explanation.getProvider(), explanation.getExplanationText());
        }
        return AiContribution.failed();
    }

    private OverrideEvent toOverrideEvent(DecisionOverrideEntity entity) {
        return new OverrideEvent(entity.getOverrideId(), entity.getRecordId(), entity.getCreatedAt(),
                entity.getOverriddenBy(), entity.getJustification(),
                OverrideStatus.valueOf(entity.getResultingStatus()));
    }

    private DecisionRecord withAiContribution(DecisionRecord record, AiContribution aiContribution) {
        return new DecisionRecord(record.recordId(), record.certificateNumber(), record.createdAt(),
                record.proposal(), record.customerSnapshot(), record.holdingsSnapshot(),
                record.schemeSnapshot(), record.ruleResults(), record.verdict(),
                record.verdictReason(), aiContribution, record.provenance(), record.overrides());
    }

    private DecisionRecord withOverrides(DecisionRecord record, List<OverrideEvent> overrideEvents) {
        return new DecisionRecord(record.recordId(), record.certificateNumber(), record.createdAt(),
                record.proposal(), record.customerSnapshot(), record.holdingsSnapshot(),
                record.schemeSnapshot(), record.ruleResults(), record.verdict(),
                record.verdictReason(), record.aiContribution(), record.provenance(), overrideEvents);
    }

    private String serialize(DecisionRecord record) {
        try {
            return objectMapper.writeValueAsString(record);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to serialise DecisionRecord " + record.recordId(), ex);
        }
    }

    private DecisionRecord deserialize(String payload) {
        try {
            return objectMapper.readValue(payload, DecisionRecord.class);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Failed to deserialise a stored DecisionRecord", ex);
        }
    }
}
