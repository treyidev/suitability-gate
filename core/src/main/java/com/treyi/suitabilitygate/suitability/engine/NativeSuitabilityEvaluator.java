package com.treyi.suitabilitygate.suitability.engine;

import java.util.List;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import com.treyi.suitabilitygate.suitability.EvaluationContext;
import com.treyi.suitabilitygate.suitability.EvaluationOutcome;
import com.treyi.suitabilitygate.suitability.RuleResult;
import com.treyi.suitabilitygate.suitability.SuitabilityEvaluator;
import com.treyi.suitabilitygate.suitability.SuitabilityRule;
import com.treyi.suitabilitygate.suitability.Verdict;

/**
 * The native rules engine — runs the injected {@link SuitabilityRule} beans and composes the verdict.
 *
 * <p>This is the default (and, in Phase 1, only) {@link SuitabilityEvaluator}. It is selected by
 * {@code suitabilitygate.engine=native} (the default when unset); a future DMN engine registers under a
 * different value and is chosen without touching the pipeline.
 *
 * <p><b>Composition (brief D14):</b> run every enabled rule, then FLAGGED iff any result is a blocking
 * (FLAG-severity) failure, else PASS. The {@code verdictReason} concatenates the plain-English of the
 * blocking failures. SKIPPED and WARN/INFO results are recorded but never flip the verdict.
 *
 * <p>Rules run in bean-discovery order; because rules are independent (no chaining), order does not
 * affect the verdict — only the display order of results.
 */
@Component
@ConditionalOnProperty(name = "suitabilitygate.engine", havingValue = "native", matchIfMissing = true)
public class NativeSuitabilityEvaluator implements SuitabilityEvaluator {

    private static final Logger log = LoggerFactory.getLogger(NativeSuitabilityEvaluator.class);

    private final List<SuitabilityRule> rules;

    /**
     * @param rules all discovered rule beans; may be empty (verdict then trivially PASS)
     */
    public NativeSuitabilityEvaluator(List<SuitabilityRule> rules) {
        this.rules = List.copyOf(rules);
        log.info("Native suitability engine initialised with {} rule(s): {}",
                this.rules.size(), this.rules.stream().map(SuitabilityRule::id).toList());
    }

    @Override
    public EvaluationOutcome evaluate(EvaluationContext ctx) {
        List<RuleResult> results = rules.stream()
                .filter(SuitabilityRule::isEnabled)
                .map(rule -> runOne(rule, ctx))
                .toList();

        List<RuleResult> blocking = results.stream()
                .filter(RuleResult::isBlockingFailure)
                .toList();

        Verdict verdict = blocking.isEmpty() ? Verdict.PASS : Verdict.FLAGGED;
        String verdictReason = composeReason(verdict, blocking);

        log.info("Verdict {} from {} rule result(s), {} blocking",
                verdict, results.size(), blocking.size());
        return new EvaluationOutcome(results, verdict, verdictReason);
    }

    private RuleResult runOne(SuitabilityRule rule, EvaluationContext ctx) {
        RuleResult result = rule.evaluate(ctx);
        log.debug("Rule {} v{} -> {} ({})", result.ruleId(), result.ruleVersion(),
                result.outcome(), result.severity());
        return result;
    }

    private String composeReason(Verdict verdict, List<RuleResult> blocking) {
        if (verdict == Verdict.PASS) {
            return "All applicable suitability checks passed.";
        }
        return blocking.stream()
                .map(RuleResult::plainEnglish)
                .collect(Collectors.joining(" "));
    }
}
