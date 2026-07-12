package com.treyi.suitabilitygate.suitability;

import java.util.Optional;
import java.util.UUID;

/**
 * The RM co-pilot seam — proposes a suitable {@link ProposedPlan} for a customer.
 *
 * <p><b>Why an interface:</b> it makes the <em>proposer itself</em> swappable, exactly like
 * {@link SuitabilityEvaluator} makes the engine swappable. The Phase-1 implementation is a rules-aware
 * deterministic proposer (screens candidate schemes through the real gate and picks a passing one); a
 * Phase-2 {@code GeminiPlanProposer} — a live model behind the explanation service — drops in behind this
 * same interface, selected by one config value, with zero change upstream.
 *
 * <p><b>The guarantee holds regardless of implementation:</b> whatever proposes the plan, the plan is an
 * <em>input</em> a human accepts and the deterministic gate adjudicates on Submit — never a verdict. The
 * proposer only ever offers plans that are <em>likely</em> to pass; the gate remains the sole authority.
 *
 * @see ProposedPlan
 */
public interface PlanProposer {

    /**
     * Propose a suitable plan for a customer, or empty when no scheme in the catalogue clears the gate for
     * them (an honest "none" — the co-pilot never suggests a product its own gate would flag).
     *
     * @param customerId the customer to propose for
     * @param rmId       the requesting RM's id, from the JWT (used only to form the ephemeral screening
     *                   proposals — nothing is persisted, so it never reaches an audit record)
     * @param branchCode the requesting RM's branch, from the JWT (same ephemeral use as {@code rmId})
     * @return a suggested plan, or {@link Optional#empty()} if none is suitable
     * @throws ResourceNotFoundException if the customer cannot be resolved
     */
    Optional<ProposedPlan> propose(UUID customerId, String rmId, String branchCode);
}
