package com.treyi.suitabilitygate.suitability;

/**
 * The overall outcome of an evaluation, composed from the rule results (brief D14).
 *
 * <p>Composition is deliberately explainable in one sentence: <em>any FLAG-severity FAIL makes the
 * verdict {@code FLAGGED}; otherwise it is {@code PASS}</em>. WARN/INFO annotate; SKIPPED never counts.
 *
 * <p>A {@code FLAGGED} verdict is not a hard block — in Phase 2 a supervisor may override it with
 * mandatory justification. The gate flags and records; the human decides.
 */
public enum Verdict {
    PASS,
    FLAGGED
}
