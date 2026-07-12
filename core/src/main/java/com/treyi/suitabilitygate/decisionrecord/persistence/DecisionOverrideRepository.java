package com.treyi.suitabilitygate.decisionrecord.persistence;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Spring Data repository for supervisor reviews (override events). Internal to the {@code decisionrecord}
 * module.
 *
 * <p>Append-only in practice: only {@code save}, {@code existsByRecordId} (the one-review-per-record guard),
 * {@code findByRecordId} (single-record stitch), and {@code findAll} (the dashboard's batch stitch) are used
 * — no update or delete surface.
 */
public interface DecisionOverrideRepository extends JpaRepository<DecisionOverrideEntity, UUID> {

    /** True if the given decision already has a recorded review (the first-wins guard). */
    boolean existsByRecordId(UUID recordId);

    /** All review events for one decision, for the single-record read stitch. */
    List<DecisionOverrideEntity> findByRecordId(UUID recordId);
}
