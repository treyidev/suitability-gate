package com.treyi.suitabilitygate.suitability;

import java.util.Objects;

import com.treyi.suitabilitygate.shared.SourceSystem;

/**
 * Provenance of a decision — the "how was this judged" metadata frozen into every record.
 *
 * <p>Carries the data source, engine and ruleset versions (so a decision is traceable to the exact
 * logic and thresholds that produced it), the measured evaluation latency (the "evaluated in 4ms"
 * headline / proof the check did not slow the sale), and the capability flags that were in effect.
 *
 * @param dataSource           origin of the data judged (SYNTHETIC now, IDBI later)
 * @param engineVersion        version of the evaluation engine
 * @param rulesetVersion       version of the ruleset that judged this decision
 * @param evaluationDurationMs measured verdict latency in milliseconds
 * @param capabilities         which optional data capabilities were available at evaluation time
 */
public record Provenance(
        SourceSystem dataSource,
        String engineVersion,
        String rulesetVersion,
        long evaluationDurationMs,
        Capabilities capabilities) {

    public Provenance {
        Objects.requireNonNull(dataSource, "dataSource");
        Objects.requireNonNull(engineVersion, "engineVersion");
        Objects.requireNonNull(rulesetVersion, "rulesetVersion");
        Objects.requireNonNull(capabilities, "capabilities");
    }

    /**
     * Capability flags recorded with a decision — makes "what could NOT be checked" auditable.
     *
     * @param holdingsAvailable whether holdings data was available (false in Phase 1)
     */
    public record Capabilities(boolean holdingsAvailable) {
    }
}
