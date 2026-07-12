package com.treyi.suitabilitygate.suitability.ruleset;

import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.treyi.suitabilitygate.shared.RiskCategory;
import com.treyi.suitabilitygate.shared.RiskometerLevel;

/**
 * The versioned suitability ruleset — the typed, immutable image of {@code ruleset/ruleset-*.yaml}.
 *
 * <p><b>Why this exists:</b> thresholds live in the versioned YAML, never in code (locked decision
 * D13). Rules receive this object and read their limits from it; compliance can retune the file
 * without a release, and {@link #version()} is stamped into every DecisionRecord so any decision is
 * traceable to the exact thresholds that judged it.
 *
 * <p><b>Lifecycle:</b> bound once at startup by {@link RulesetLoader}, validated fail-fast, then
 * injected as an immutable singleton. Internal to the {@code suitability} module (this subpackage is
 * not part of the module's published API).
 *
 * <p>Nested records mirror the YAML structure; SCREAMING_SNAKE rule ids in the file map onto the
 * {@link Rules} components via {@link JsonProperty}.
 *
 * @param version ruleset version string (e.g. {@code 2026.07.1}), stamped into every DecisionRecord
 * @param rules   per-rule configuration blocks, keyed by rule id in the YAML
 */
public record Ruleset(String version, Rules rules) {

    public Ruleset {
        Objects.requireNonNull(version, "version");
        Objects.requireNonNull(rules, "rules");
        if (version.isBlank()) {
            throw new IllegalArgumentException("ruleset version must not be blank");
        }
    }

    /**
     * The Phase-1 rule blocks. Each component is required: a missing block in the YAML is a
     * configuration error surfaced at startup, not a silently disabled rule.
     *
     * @param ageRiskBand     {@code AGE_RISK_BAND} thresholds
     * @param horizonLockin   {@code HORIZON_LOCKIN} switch (pure comparison, no thresholds)
     * @param statedRiskMatch {@code STATED_RISK_MATCH} category caps
     * @param seniorEnhanced  {@code SENIOR_ENHANCED} composite thresholds
     */
    public record Rules(
            @JsonProperty("AGE_RISK_BAND") AgeRiskBand ageRiskBand,
            @JsonProperty("HORIZON_LOCKIN") HorizonLockin horizonLockin,
            @JsonProperty("STATED_RISK_MATCH") StatedRiskMatch statedRiskMatch,
            @JsonProperty("SENIOR_ENHANCED") SeniorEnhanced seniorEnhanced) {

        public Rules {
            Objects.requireNonNull(ageRiskBand, "rules.AGE_RISK_BAND missing from ruleset");
            Objects.requireNonNull(horizonLockin, "rules.HORIZON_LOCKIN missing from ruleset");
            Objects.requireNonNull(statedRiskMatch, "rules.STATED_RISK_MATCH missing from ruleset");
            Objects.requireNonNull(seniorEnhanced, "rules.SENIOR_ENHANCED missing from ruleset");
        }
    }

    /**
     * {@code AGE_RISK_BAND} — age bracket caps the permissible scheme riskometer.
     *
     * @param enabled  whether the rule runs
     * @param ageBands ordered bands; the first band with {@code age <= maxAge} applies
     */
    public record AgeRiskBand(boolean enabled, List<AgeBand> ageBands) {

        public AgeRiskBand {
            ageBands = List.copyOf(ageBands);
            if (ageBands.isEmpty()) {
                throw new IllegalArgumentException("AGE_RISK_BAND.ageBands must not be empty");
            }
        }

        /**
         * One age band.
         *
         * @param maxAge inclusive upper age bound of this band
         * @param cap    maximum permissible riskometer for the band
         */
        public record AgeBand(int maxAge, RiskometerLevel cap) {
            public AgeBand {
                Objects.requireNonNull(cap, "ageBand.cap");
            }
        }
    }

    /**
     * {@code HORIZON_LOCKIN} — stated horizon shorter than scheme lock-in. Pure comparison; the only
     * knob is the enable switch.
     *
     * @param enabled whether the rule runs
     */
    public record HorizonLockin(boolean enabled) {
    }

    /**
     * {@code STATED_RISK_MATCH} — stated risk category caps the permissible scheme riskometer.
     *
     * @param enabled whether the rule runs
     * @param caps    max riskometer per stated category; must cover every {@link RiskCategory}
     */
    public record StatedRiskMatch(boolean enabled, Map<RiskCategory, RiskometerLevel> caps) {

        public StatedRiskMatch {
            caps = Map.copyOf(caps);
            for (RiskCategory category : RiskCategory.values()) {
                if (!caps.containsKey(category)) {
                    throw new IllegalArgumentException(
                            "STATED_RISK_MATCH.caps missing entry for " + category);
                }
            }
        }
    }

    /**
     * {@code SENIOR_ENHANCED} — composite stricter check for seniors: senior AND (high-volatility
     * scheme OR lock-in beyond {@code maxLockInMonths}) fails.
     *
     * @param enabled         whether the rule runs
     * @param seniorAge       age (inclusive) from which the customer counts as senior for this rule
     * @param maxLockInMonths lock-in months above which a scheme fails for a senior
     */
    public record SeniorEnhanced(boolean enabled, int seniorAge, int maxLockInMonths) {

        public SeniorEnhanced {
            if (seniorAge <= 0) {
                throw new IllegalArgumentException("SENIOR_ENHANCED.seniorAge must be > 0, was " + seniorAge);
            }
            if (maxLockInMonths < 0) {
                throw new IllegalArgumentException(
                        "SENIOR_ENHANCED.maxLockInMonths must be >= 0, was " + maxLockInMonths);
            }
        }
    }
}
