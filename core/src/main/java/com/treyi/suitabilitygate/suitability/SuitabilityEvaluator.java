package com.treyi.suitabilitygate.suitability;

/**
 * The rules-engine seam — the component that runs the rules and composes a verdict.
 *
 * <p><b>Why an interface:</b> it makes the <em>engine itself</em> swappable, not just individual rules.
 * The pipeline (stage 3) depends only on this type. Today the single implementation is the native engine
 * that runs {@link SuitabilityRule} beans; a future DMN / decision-table engine (Kogito, OpenL) is
 * another implementation selected by one config value ({@code suitabilitygate.engine=native|dmn}),
 * with zero change upstream — the projected scale path (addendum A6/§4.5).
 *
 * <p>Whatever the implementation, the guarantee holds: the verdict is produced here by deterministic
 * code, is replayable, and is never influenced by an LLM.
 */
public interface SuitabilityEvaluator {

    /**
     * Run the applicable rules against the context and compose the verdict.
     *
     * @param ctx the resolved, immutable evaluation inputs
     * @return the rule results plus the composed verdict — never null
     */
    EvaluationOutcome evaluate(EvaluationContext ctx);
}
