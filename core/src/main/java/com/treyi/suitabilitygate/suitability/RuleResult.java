package com.treyi.suitabilitygate.suitability;

import java.util.Map;
import java.util.Objects;

/**
 * The immutable output of a single rule — one row of the DecisionRecord's {@code ruleResults[]} (§6).
 *
 * <p><b>Why this shape:</b> auditability is the product's moat, so every rule must surface not just an
 * outcome but the exact inputs it read, the threshold it applied, and a plain-English sentence a human
 * (or regulator) can understand. Those are the {@code inputsConsumed} / {@code thresholdApplied} /
 * {@code plainEnglish} fields — they make each decision self-explaining and replayable.
 *
 * <p>Use the static factories ({@link #pass}, {@link #fail}, {@link #skipped}) rather than the
 * canonical constructor — they keep rules terse and set {@link Outcome} consistently.
 *
 * @param ruleId          stable rule identifier, e.g. {@code AGE_RISK_BAND}
 * @param ruleVersion     version of the rule logic, e.g. {@code 1.0}
 * @param severity        the rule's severity (fixed per rule)
 * @param outcome         PASS / FAIL / SKIPPED
 * @param skippedReason   why the rule was skipped, or null when it ran
 * @param inputsConsumed  the exact inputs the rule read (for replay/audit); never null
 * @param thresholdApplied the threshold(s) applied from the ruleset; never null
 * @param plainEnglish    a human-readable sentence explaining this result; never null/blank
 */
public record RuleResult(
        String ruleId,
        String ruleVersion,
        Severity severity,
        Outcome outcome,
        String skippedReason,
        Map<String, Object> inputsConsumed,
        Map<String, Object> thresholdApplied,
        String plainEnglish) {

    public RuleResult {
        Objects.requireNonNull(ruleId, "ruleId");
        Objects.requireNonNull(ruleVersion, "ruleVersion");
        Objects.requireNonNull(severity, "severity");
        Objects.requireNonNull(outcome, "outcome");
        Objects.requireNonNull(plainEnglish, "plainEnglish");
        if (plainEnglish.isBlank()) {
            throw new IllegalArgumentException("plainEnglish must not be blank for rule " + ruleId);
        }
        inputsConsumed = inputsConsumed == null ? Map.of() : Map.copyOf(inputsConsumed);
        thresholdApplied = thresholdApplied == null ? Map.of() : Map.copyOf(thresholdApplied);
    }

    /** Whether this result blocks the verdict — a FLAG-severity failure (brief D14). */
    public boolean isBlockingFailure() {
        return severity == Severity.FLAG && outcome == Outcome.FAIL;
    }

    /** A PASS result: the check ran and is acceptable. */
    public static RuleResult pass(String ruleId, String ruleVersion, Severity severity,
            Map<String, Object> inputsConsumed, Map<String, Object> thresholdApplied, String plainEnglish) {
        return new RuleResult(ruleId, ruleVersion, severity, Outcome.PASS, null,
                inputsConsumed, thresholdApplied, plainEnglish);
    }

    /** A FAIL result: the check ran and found a problem; {@code severity} decides the impact. */
    public static RuleResult fail(String ruleId, String ruleVersion, Severity severity,
            Map<String, Object> inputsConsumed, Map<String, Object> thresholdApplied, String plainEnglish) {
        return new RuleResult(ruleId, ruleVersion, severity, Outcome.FAIL, null,
                inputsConsumed, thresholdApplied, plainEnglish);
    }

    /** A SKIPPED result: the check could not run; {@code reason} is recorded for auditability. */
    public static RuleResult skipped(String ruleId, String ruleVersion, Severity severity,
            String reason, String plainEnglish) {
        Objects.requireNonNull(reason, "skippedReason");
        return new RuleResult(ruleId, ruleVersion, severity, Outcome.SKIPPED, reason,
                Map.of(), Map.of(), plainEnglish);
    }
}
