package com.treyi.suitabilitygate.suitability.rules;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.treyi.suitabilitygate.shared.VolatilityClass;
import com.treyi.suitabilitygate.suitability.EvaluationContext;
import com.treyi.suitabilitygate.suitability.RuleResult;
import com.treyi.suitabilitygate.suitability.Severity;
import com.treyi.suitabilitygate.suitability.SuitabilityRule;
import com.treyi.suitabilitygate.suitability.ruleset.Ruleset;

/**
 * {@code SENIOR_ENHANCED} — a stricter composite check for senior citizens. A senior (age at or above
 * the configured {@code seniorAge}) proposed a high-volatility scheme OR a scheme whose lock-in exceeds
 * the configured senior limit fails: seniors typically need liquidity and capital preservation.
 *
 * <p>Stricter than {@code AGE_RISK_BAND}: it can trip even when the age band alone would not, because it
 * looks at volatility and lock-in rather than riskometer. Thresholds ({@code seniorAge},
 * {@code maxLockInMonths}) come from the ruleset.
 */
@Component
@Order(30)
public class SeniorEnhancedRule implements SuitabilityRule {

    private static final Logger log = LoggerFactory.getLogger(SeniorEnhancedRule.class);

    private static final String RULE_ID = "SENIOR_ENHANCED";
    private static final String RULE_VERSION = "1.0";

    private final Ruleset ruleset;

    public SeniorEnhancedRule(Ruleset ruleset) {
        this.ruleset = ruleset;
    }

    @Override
    public String id() {
        return RULE_ID;
    }

    @Override
    public String ruleVersion() {
        return RULE_VERSION;
    }

    @Override
    public Severity severity() {
        return Severity.FLAG;
    }

    @Override
    public boolean isEnabled() {
        return ruleset.rules().seniorEnhanced().enabled();
    }

    @Override
    public RuleResult evaluate(EvaluationContext ctx) {
        Ruleset.SeniorEnhanced cfg = ruleset.rules().seniorEnhanced();
        int ageYears = ctx.customer().ageYears();
        VolatilityClass volatility = ctx.scheme().volatilityClass();
        int lockInMonths = ctx.scheme().lockInMonths();

        boolean isSenior = ageYears >= cfg.seniorAge();
        boolean highVolatility = volatility == VolatilityClass.HIGH;
        boolean lockInTooLong = lockInMonths > cfg.maxLockInMonths();

        Map<String, Object> inputs = Map.of(
                "ageYears", ageYears,
                "schemeVolatility", volatility,
                "schemeLockInMonths", lockInMonths);
        Map<String, Object> thresholds = Map.of(
                "seniorAge", cfg.seniorAge(),
                "maxLockInMonths", cfg.maxLockInMonths(),
                "disallowedVolatility", VolatilityClass.HIGH);

        if (isSenior && (highVolatility || lockInTooLong)) {
            List<String> reasons = new ArrayList<>();
            if (highVolatility) {
                reasons.add("the scheme is high-volatility");
            }
            if (lockInTooLong) {
                reasons.add("its %d-month lock-in exceeds the %d-month senior limit"
                        .formatted(lockInMonths, cfg.maxLockInMonths()));
            }
            String plain = "Customer is a senior citizen (age %d); %s — this requires enhanced suitability review."
                    .formatted(ageYears, String.join(" and ", reasons));
            log.debug("{} FAIL: age={} volatility={} lockIn={}", RULE_ID, ageYears, volatility, lockInMonths);
            return RuleResult.fail(RULE_ID, RULE_VERSION, Severity.FLAG, inputs, thresholds, plain);
        }

        String plain = isSenior
                ? "Customer is a senior citizen (age %d); the scheme is neither high-volatility nor long-locked, so the enhanced senior check passes."
                        .formatted(ageYears)
                : "Customer is not a senior citizen (age %d); the enhanced senior check does not apply."
                        .formatted(ageYears);
        return RuleResult.pass(RULE_ID, RULE_VERSION, Severity.FLAG, inputs, thresholds, plain);
    }
}
