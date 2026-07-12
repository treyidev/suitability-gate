package com.treyi.suitabilitygate.decisionrecord.persistence;

import java.time.Instant;
import java.util.UUID;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * JPA row of the append-only ledger. Internal to the {@code decisionrecord} module (this subpackage is
 * not part of any module API).
 *
 * <p><b>Why a class, not a record:</b> JPA mandates a no-arg constructor and field access — a framework
 * requirement, one of the sanctioned reasons to use a class. It is still effectively immutable: no
 * setters, written once by {@link JpaDecisionLedger#record}.
 *
 * <p><b>Storage shape:</b> the full {@link com.treyi.suitabilitygate.suitability.DecisionRecord} is kept
 * as a JSON document in {@code payload} (an audit record is read whole and never partially updated), with
 * the fields compliance filters on lifted into columns indexed by the Flyway migration ({@code branch_code},
 * {@code rm_id}, {@code verdict}, {@code created_at}). {@code payload} is {@code text} now; upgrading to
 * Postgres {@code jsonb} for in-document querying is a later, isolated migration.
 *
 * <p>The schema is owned by Flyway ({@code db/migration/V*.sql}); this entity is validated against it.
 */
@Entity
@Table(name = "decision_records")
public class DecisionRecordEntity {

    @Id
    @Column(name = "record_id", nullable = false, updatable = false)
    private UUID recordId;

    @Column(name = "certificate_number", nullable = false, unique = true, updatable = false)
    private String certificateNumber;

    @Column(name = "branch_code", updatable = false)
    private String branchCode;

    @Column(name = "rm_id", updatable = false)
    private String rmId;

    @Column(name = "verdict", nullable = false, updatable = false)
    private String verdict;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "payload", columnDefinition = "text", nullable = false, updatable = false)
    private String payload;

    /** For JPA only. */
    protected DecisionRecordEntity() {
    }

    DecisionRecordEntity(UUID recordId, String certificateNumber, String branchCode, String rmId,
            String verdict, Instant createdAt, String payload) {
        this.recordId = recordId;
        this.certificateNumber = certificateNumber;
        this.branchCode = branchCode;
        this.rmId = rmId;
        this.verdict = verdict;
        this.createdAt = createdAt;
        this.payload = payload;
    }

    UUID getRecordId() {
        return recordId;
    }

    String getCertificateNumber() {
        return certificateNumber;
    }

    String getPayload() {
        return payload;
    }
}
