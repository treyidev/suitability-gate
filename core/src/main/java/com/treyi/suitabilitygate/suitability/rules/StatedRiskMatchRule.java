package com.treyi.suitabilitygate.suitability.rules;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.treyi.suitabilitygate.shared.RiskCategory;
import com.treyi.suitabilitygate.shared.RiskometerLevel;
import com.treyi.suitabilitygate.suitability.EvaluationContext;
import com.treyi.suitabilitygate.suitability.RuleResult;
import com.treyi.suitabilitygate.suitability.Severity;
import com.treyi.suitabilitygate.suitability.SuitabilityRule;
import com.treyi.suitabilitygate.suitability.ruleset.Ruleset;

/**
 * {@code STATED_RISK_MATCH} — the scheme's riskometer must not exceed the cap implied by the customer's
 * own stated risk category. Catches "conservative investor put into a very-high-risk fund" — a direct
 * contradiction of what the customer declared.
 *
 * <p>The category → maximum-riskometer mapping comes entirely from the ruleset (validated at load to
 * cover every category), so it never SKIPs and never hardcodes a cap.
 */
@Component
@Order(20)
public class StatedRiskMatchRule implements SuitabilityRule {

    private static final Logger log = LoggerFactory.getLogger(StatedRiskMatchRule.class);

    private static final String RULE_ID = "STATED_RISK_MATCH";
    private static final String RULE_VERSION = "1.0";

    private final Ruleset ruleset;

    public StatedRiskMatchRule(Ruleset ruleset) {
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
        return ruleset.rules().statedRiskMatch().enabled();
    }

    @Override
    public RuleResult evaluate(EvaluationContext ctx) {
        RiskCategory category = ctx.customer().riskCategory();
        RiskometerLevel schemeRisk = ctx.scheme().riskometerLevel();
        RiskometerLevel cap = ruleset.rules().statedRiskMatch().caps().get(category);

        Map<String, Object> inputs = Map.of(
                "statedRiskCategory", category,
                "schemeRiskometer", schemeRisk);
        Map<String, Object> thresholds = Map.of(
                "maxRiskometerForCategory", cap);

        if (schemeRisk.isAbove(cap)) {
            String plain = "Customer's stated risk profile is %s; scheme risk level %s exceeds the maximum permitted (%s) for that profile."
                    .formatted(RuleText.humanize(category), RuleText.humanize(schemeRisk), RuleText.humanize(cap));
            log.debug("{} FAIL: category={} schemeRisk={} cap={}", RULE_ID, category, schemeRisk, cap);
            return RuleResult.fail(RULE_ID, RULE_VERSION, Severity.FLAG, inputs, thresholds, plain);
        }

        String plain = "Customer's stated risk profile is %s; scheme risk level %s is within the maximum permitted (%s) for that profile."
                .formatted(RuleText.humanize(category), RuleText.humanize(schemeRisk), RuleText.humanize(cap));
        return RuleResult.pass(RULE_ID, RULE_VERSION, Severity.FLAG, inputs, thresholds, plain);
    }
}
