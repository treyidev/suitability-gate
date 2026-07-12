package com.treyi.suitabilitygate.decisionrecord.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA row of a supervisor review (brief §6.1 OverrideEvent) — a separate, append-only side record that
 * keeps {@code decision_records} itself append-only (the decision row is never UPDATEd; the review lives
 * here and is stitched into the returned record on read). Internal to the {@code decisionrecord} module.
 *
 * <p><b>Why a class, not a record:</b> JPA mandates a no-arg constructor — the same sanctioned framework
 * exception as {@link DecisionRecordEntity} / {@link DecisionExplanationEntity}. Effectively immutable: no
 * setters, written once by {@link JpaDecisionLedger#attachOverride}.
 *
 * <p><b>Multiple rows per record are possible by construction</b> (append-only events keyed by
 * {@code override_id}, indexed by {@code record_id}); Phase-1 policy enforces one review per record at the
 * write boundary, so in practice there is at most one — but the schema does not assume it.
 */
@Entity
@Table(name = "decision_overrides")
public class DecisionOverrideEntity {

    @Id
    @Column(name = "override_id", nullable = false, updatable = false)
    private UUID overrideId;

    @Column(name = "record_id", nullable = false, updatable = false)
    private UUID recordId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "overridden_by", nullable = false, updatable = false)
    private String overriddenBy;

    @Column(name = "justification", columnDefinition = "text", nullable = false, updatable = false)
    private String justification;

    @Column(name = "resulting_status", nullable = false, updatable = false)
    private String resultingStatus;

    /** For JPA only. */
    protected DecisionOverrideEntity() {
    }

    DecisionOverrideEntity(UUID overrideId, UUID recordId, Instant createdAt, String overriddenBy,
            String justification, String resultingStatus) {
        this.overrideId = overrideId;
        this.recordId = recordId;
        this.createdAt = createdAt;
        this.overriddenBy = overriddenBy;
        this.justification = justification;
        this.resultingStatus = resultingStatus;
    }

    UUID getOverrideId() {
        return overrideId;
    }

    UUID getRecordId() {
        return recordId;
    }

    Instant getCreatedAt() {
        return createdAt;
    }

    String getOverriddenBy() {
        return overriddenBy;
    }

    String getJustification() {
        return justification;
    }

    String getResultingStatus() {
        return resultingStatus;
    }
}
