package com.treyi.suitabilitygate.decisionrecord.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA row of an async explanation attachment — the insert-once side record that keeps
 * {@code decision_records} itself append-only (the decision row is never UPDATEd; the explanation
 * lives here and is overlaid on read). Internal to the {@code decisionrecord} module.
 *
 * <p><b>Why a class, not a record:</b> JPA mandates a no-arg constructor — same sanctioned framework
 * exception as {@link DecisionRecordEntity}. Effectively immutable: no setters, written once by
 * {@link JpaDecisionLedger#attachExplanation} / {@link JpaDecisionLedger#markExplanationFailed}.
 *
 * <p>PENDING is represented by the ABSENCE of a row (the frozen record's own {@code aiContribution}
 * already says PENDING); a row exists only once the outcome is known — {@code ATTACHED} or
 * {@code FAILED}.
 */
@Entity
@Table(name = "decision_explanations")
public class DecisionExplanationEntity {

    @Id
    @Column(name = "record_id", nullable = false, updatable = false)
    private UUID recordId;

    @Column(name = "status", nullable = false, updatable = false)
    private String status;

    @Column(name = "provider", updatable = false)
    private String provider;

    @Column(name = "explanation_text", columnDefinition = "text", updatable = false)
    private String explanationText;

    @Column(name = "attached_at", nullable = false, updatable = false)
    private Instant attachedAt;

    /** For JPA only. */
    protected DecisionExplanationEntity() {
    }

    DecisionExplanationEntity(UUID recordId, String status, String provider, String explanationText,
            Instant attachedAt) {
        this.recordId = recordId;
        this.status = status;
        this.provider = provider;
        this.explanationText = explanationText;
        this.attachedAt = attachedAt;
    }

    String getStatus() {
        return status;
    }

    String getProvider() {
        return provider;
    }

    String getExplanationText() {
        return explanationText;
    }
}
