package com.treyi.suitabilitygate.suitability;

/**
 * A single suitability check. THE extension point of the rules engine (brief §4/§9).
 *
 * <p>Implementations are Spring beans, auto-discovered by injection — <strong>adding a rule is dropping
 * in one class</strong>; the engine and pipeline are untouched. Each rule is self-describing (id,
 * version, severity), reads its thresholds from the injected
 * {@link com.treyi.suitabilitygate.suitability.ruleset.Ruleset}, and emits a fully-populated
 * {@link RuleResult} (inputs consumed, threshold applied, plain English) for the audit record.
 *
 * <p>Contract: a rule reads ONLY from the {@link EvaluationContext} (and its injected ruleset config).
 * It never touches a data source, never references another rule, and never contributes anything but its
 * own {@link RuleResult}. When required data is absent it returns {@link RuleResult#skipped} rather than
 * guessing.
 */
public interface SuitabilityRule {

    /** Stable identifier, e.g. {@code AGE_RISK_BAND}. Matches the ruleset config key. */
    String id();

    /** Version of this rule's logic, stamped into its {@link RuleResult}. */
    String ruleVersion();

    /** Fixed severity of this rule (brief D14). */
    Severity severity();

    /**
     * Whether this rule is enabled in the active ruleset. Disabled rules are not run and produce no
     * result (distinct from SKIPPED, which means "enabled but could not run").
     *
     * @return true if the rule should run
     */
    boolean isEnabled();

    /**
     * Evaluate this rule against the resolved context.
     *
     * @param ctx the resolved, immutable evaluation inputs
     * @return this rule's result — never null
     */
    RuleResult evaluate(EvaluationContext ctx);
}
