package com.treyi.suitabilitygate.suitability;

/**
 * The record's honest statement of what AI did and did NOT contribute — the auditability centrepiece.
 *
 * <p>Encodes the core thesis in the artifact itself: AI contributes plain-language explanation text
 * only; it never contributes the verdict, rule outcomes, thresholds, numbers, or product judgments.
 * The explanation is attached asynchronously and is absent (PENDING) when the record is first frozen.
 *
 * @param contributed      what AI contributed (fixed statement)
 * @param didNotContribute what AI did NOT contribute (fixed statement)
 * @param explanationStatus lifecycle of the async explanation
 * @param provider         the LLM provider once attached, or null
 * @param explanationText  the attached prose, or null until attached
 */
public record AiContribution(
        String contributed,
        String didNotContribute,
        ExplanationStatus explanationStatus,
        String provider,
        String explanationText) {

    private static final String CONTRIBUTED = "plain-language explanation text only";
    private static final String DID_NOT_CONTRIBUTE =
            "verdict, rule outcomes, thresholds, numbers, product judgments";

    /** The initial state on a freshly frozen record: explanation pending, no provider, no text. */
    public static AiContribution pending() {
        return new AiContribution(CONTRIBUTED, DID_NOT_CONTRIBUTE, ExplanationStatus.PENDING, null, null);
    }

    /**
     * The state after the async handler attached the rendered prose.
     *
     * @param provider        which generation path produced the text (e.g. {@code stub-canned-v1})
     * @param explanationText the rendered plain-language prose
     */
    public static AiContribution attached(String provider, String explanationText) {
        return new AiContribution(CONTRIBUTED, DID_NOT_CONTRIBUTE, ExplanationStatus.ATTACHED,
                provider, explanationText);
    }

    /** The state after the async render failed — the decision stands, only the prose is absent. */
    public static AiContribution failed() {
        return new AiContribution(CONTRIBUTED, DID_NOT_CONTRIBUTE, ExplanationStatus.FAILED, null, null);
    }
}
