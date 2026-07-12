package com.treyi.suitabilitygate.decisionrecord.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * Spring Data repository for the ledger. Internal to the {@code decisionrecord} module.
 *
 * <p>Append-only in practice: only {@code save} and reads are used (no update/delete surface is
 * exercised). Exposes the certificate-number allocator backed by a Postgres sequence.
 */
public interface DecisionRecordRepository extends JpaRepository<DecisionRecordEntity, UUID> {

    /**
     * Allocate the next certificate sequence value atomically (Postgres {@code certificate_seq}, created
     * by {@code schema.sql}). Monotonic across restarts; gaps are acceptable.
     *
     * @return the next sequence number
     */
    @Query(value = "SELECT nextval('certificate_seq')", nativeQuery = true)
    long nextCertificateSequence();

    /**
     * All ledger rows, newest decision first — the read that backs the compliance dashboard's whole-ledger
     * view. Newest-first because the dashboard's records table and time-oriented widgets read most-recent-down.
     *
     * <p>Ordering is on the indexed {@code created_at} column, so this stays a single indexed scan.
     *
     * @return every persisted decision entity, ordered by creation time descending
     */
    List<DecisionRecordEntity> findAllByOrderByCreatedAtDesc();
}
