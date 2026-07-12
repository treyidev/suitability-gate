package com.treyi.suitabilitygate.suitability.rules;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.treyi.suitabilitygate.shared.RiskometerLevel;
import com.treyi.suitabilitygate.suitability.EvaluationContext;
import com.treyi.suitabilitygate.suitability.RuleResult;
import com.treyi.suitabilitygate.suitability.Severity;
import com.treyi.suitabilitygate.suitability.SuitabilityRule;
import com.treyi.suitabilitygate.suitability.ruleset.Ruleset;

/**
 * {@code AGE_RISK_BAND} — the SEBI headline check: a customer's age caps the maximum permissible scheme
 * riskometer, so high-risk products are not sold to older investors (the canonical "70+ sold small-cap"
 * enforcement pattern).
 *
 * <p>Reads the ordered age bands from the ruleset; the first band with {@code age <= maxAge} applies. If
 * the scheme's riskometer exceeds that band's cap, the rule FAILs (FLAG severity). Age is always present
 * (derived on the profile), so this rule never SKIPs.
 */
@Component
@Order(10)
public class AgeRiskBandRule implements SuitabilityRule {

    private static final Logger log = LoggerFactory.getLogger(AgeRiskBandRule.class);

    private static final String RULE_ID = "AGE_RISK_BAND";
    private static final String RULE_VERSION = "1.0";

    private final Ruleset ruleset;

    public AgeRiskBandRule(Ruleset ruleset) {
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
        return ruleset.rules().ageRiskBand().enabled();
    }

    @Override
    public RuleResult evaluate(EvaluationContext ctx) {
        int ageYears = ctx.customer().ageYears();
        RiskometerLevel schemeRisk = ctx.scheme().riskometerLevel();
        RiskometerLevel cap = capForAge(ageYears);

        Map<String, Object> inputs = Map.of(
                "ageYears", ageYears,
                "schemeRiskometer", schemeRisk);
        Map<String, Object> thresholds = Map.of(
                "maxRiskometerForAge", cap);

        if (schemeRisk.isAbove(cap)) {
            String plain = "Customer is %d; scheme risk level %s exceeds the maximum permitted (%s) for the customer's age band."
                    .formatted(ageYears, RuleText.humanize(schemeRisk), RuleText.humanize(cap));
            log.debug("{} FAIL: age={} schemeRisk={} cap={}", RULE_ID, ageYears, schemeRisk, cap);
            return RuleResult.fail(RULE_ID, RULE_VERSION, Severity.FLAG, inputs, thresholds, plain);
        }

        String plain = "Customer is %d; scheme risk level %s is within the maximum permitted (%s) for the customer's age band."
                .formatted(ageYears, RuleText.humanize(schemeRisk), RuleText.humanize(cap));
        return RuleResult.pass(RULE_ID, RULE_VERSION, Severity.FLAG, inputs, thresholds, plain);
    }

    /** First configured band whose {@code maxAge} covers this age (bands are ordered ascending). */
    private RiskometerLevel capForAge(int ageYears) {
        return ruleset.rules().ageRiskBand().ageBands().stream()
                .filter(band -> ageYears <= band.maxAge())
                .map(Ruleset.AgeRiskBand.AgeBand::cap)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "No AGE_RISK_BAND band covers age " + ageYears
                                + " — the ruleset must include a catch-all high maxAge band"));
    }
}
