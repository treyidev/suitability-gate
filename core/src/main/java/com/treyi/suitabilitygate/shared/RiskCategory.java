package com.treyi.suitabilitygate.shared;

/**
 * A customer's stated risk tolerance, captured by the suitability questionnaire, in ascending order.
 *
 * <p>Mapped to a maximum permissible {@link RiskometerLevel} by the {@code STATED_RISK_MATCH} rule;
 * the mapping itself lives in the versioned ruleset config, never hardcoded.
 */
public enum RiskCategory {
    CONSERVATIVE,
    MODERATE,
    AGGRESSIVE
}
