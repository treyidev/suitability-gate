package com.treyi.suitabilitygate.suitability;

/**
 * The result of running a single rule against an evaluation.
 *
 * <ul>
 *   <li>{@code PASS} — the check ran and the customer/product match is acceptable for this rule.</li>
 *   <li>{@code FAIL} — the check ran and found a problem (its {@link Severity} decides the impact).</li>
 *   <li>{@code SKIPPED} — the check could not run (e.g. required data/capability absent). Recorded with
 *       a reason so the audit trail shows what could <em>not</em> be checked; never affects the verdict.</li>
 * </ul>
 */
public enum Outcome {
    PASS,
    FAIL,
    SKIPPED
}
