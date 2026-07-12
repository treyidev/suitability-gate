package com.treyi.suitabilitygate.decisionrecord.persistence;

import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Spring Data repository for explanation attachments. Internal to the {@code decisionrecord} module.
 *
 * <p>Insert-once in practice: only {@code existsById}, {@code save}, and {@code findById} are used —
 * no update or delete surface is exercised, matching the port's first-attach-wins contract.
 */
public interface DecisionExplanationRepository extends JpaRepository<DecisionExplanationEntity, UUID> {
}
