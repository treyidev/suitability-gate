package com.treyi.suitabilitygate.suitability;

import java.time.Instant;
import java.util.Objects;

import com.treyi.suitabilitygate.customerdata.CustomerProfile;
import com.treyi.suitabilitygate.schemecatalog.Scheme;

/**
 * The immutable, resolved inputs a rule evaluates against — the shared object threaded through the
 * pipeline (brief §3.3).
 *
 * <p><b>Why a single context:</b> rules read ONLY from here, never from each other or from data
 * sources directly. That keeps rules independent and testable, and makes the accumulated context the
 * seed of the DecisionRecord (the audit trail is a byproduct of coordination, not a bolt-on log).
 *
 * <p><b>Thresholds are NOT here:</b> the {@link com.treyi.suitabilitygate.suitability.ruleset.Ruleset}
 * is injected into each rule as a bean, so the context carries only decision <em>data</em>, not config.
 *
 * <p>Phase-1 rules need only profile + scheme + proposal. Holdings and capability flags are added to
 * this context when holdings-based rules arrive (Phase 2) — a new field, no change to existing rules.
 *
 * @param customer    resolved customer snapshot (stage 1)
 * @param scheme      resolved scheme snapshot (stage 2)
 * @param proposal    the RM's proposed transaction (the pipeline input)
 * @param evaluatedAt the instant this evaluation runs (provenance / correlation)
 */
public record EvaluationContext(
        CustomerProfile customer,
        Scheme scheme,
        ProposedTransaction proposal,
        Instant evaluatedAt) {

    public EvaluationContext {
        Objects.requireNonNull(customer, "customer");
        Objects.requireNonNull(scheme, "scheme");
        Objects.requireNonNull(proposal, "proposal");
        Objects.requireNonNull(evaluatedAt, "evaluatedAt");
    }
}
