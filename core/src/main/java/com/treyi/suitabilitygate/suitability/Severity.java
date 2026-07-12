package com.treyi.suitabilitygate.suitability;

/**
 * How strongly a rule failure affects the verdict (brief D14).
 *
 * <ul>
 *   <li>{@code FLAG} — a failure blocks: any FLAG-severity FAIL makes the whole verdict FLAGGED.</li>
 *   <li>{@code WARN} — a failure annotates but does not block the verdict.</li>
 *   <li>{@code INFO} — informational only; never affects the verdict.</li>
 * </ul>
 *
 * All four Phase-1 rules are {@code FLAG}; WARN/INFO rules arrive in Phase 2.
 */
public enum Severity {
    FLAG,
    WARN,
    INFO
}
