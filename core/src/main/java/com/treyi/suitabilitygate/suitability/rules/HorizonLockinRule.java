package com.treyi.suitabilitygate.suitability.rules;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import com.treyi.suitabilitygate.suitability.EvaluationContext;
import com.treyi.suitabilitygate.suitability.RuleResult;
import com.treyi.suitabilitygate.suitability.Severity;
import com.treyi.suitabilitygate.suitability.SuitabilityRule;
import com.treyi.suitabilitygate.suitability.ruleset.Ruleset;

/**
 * {@code HORIZON_LOCKIN} — the customer's stated investment horizon must be at least as long as the
 * scheme's lock-in, or their money is locked away longer than they can spare it (the classic ELSS
 * 36-month lock-in vs a short horizon).
 *
 * <p>A pure comparison with no threshold. If the horizon is unknown (null on the profile), the rule
 * records SKIPPED with a reason rather than guessing — an auditable "could not check".
 */
@Component
@Order(40)
public class HorizonLockinRule implements SuitabilityRule {

    private static final Logger log = LoggerFactory.getLogger(HorizonLockinRule.class);

    private static final String RULE_ID = "HORIZON_LOCKIN";
    private static final String RULE_VERSION = "1.0";

    private final Ruleset ruleset;

    public HorizonLockinRule(Ruleset ruleset) {
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
        return ruleset.rules().horizonLockin().enabled();
    }

    @Override
    public RuleResult evaluate(EvaluationContext ctx) {
        Integer horizonMonths = ctx.customer().investmentHorizonMonths();
        int lockInMonths = ctx.scheme().lockInMonths();

        if (horizonMonths == null) {
            log.debug("{} SKIPPED: horizon unknown (lockIn={})", RULE_ID, lockInMonths);
            return RuleResult.skipped(RULE_ID, RULE_VERSION, Severity.FLAG,
                    "customer investment horizon not on file",
                    "Customer's investment horizon is unknown; lock-in suitability could not be checked.");
        }

        Map<String, Object> inputs = Map.of(
                "investmentHorizonMonths", horizonMonths,
                "schemeLockInMonths", lockInMonths);
        Map<String, Object> thresholds = Map.of();

        if (horizonMonths < lockInMonths) {
            String plain = "Customer's investment horizon (%d months) is shorter than the scheme's lock-in (%d months)."
                    .formatted(horizonMonths, lockInMonths);
            log.debug("{} FAIL: horizon={} lockIn={}", RULE_ID, horizonMonths, lockInMonths);
            return RuleResult.fail(RULE_ID, RULE_VERSION, Severity.FLAG, inputs, thresholds, plain);
        }

        String plain = "Customer's investment horizon (%d months) covers the scheme's lock-in (%d months)."
                .formatted(horizonMonths, lockInMonths);
        return RuleResult.pass(RULE_ID, RULE_VERSION, Severity.FLAG, inputs, thresholds, plain);
    }
}
