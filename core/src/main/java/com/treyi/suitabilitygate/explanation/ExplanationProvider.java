package com.treyi.suitabilitygate.explanation;

import java.util.List;
import java.util.Objects;

import com.treyi.suitabilitygate.suitability.Verdict;

/**
 * Port to whatever renders plain-language explanation prose — the provider seam (locked D4).
 *
 * <p>Phase 1 binds {@code HttpExplanationProvider} (the stub Python service, canned text); Phase 2
 * swaps in a real LLM (Gemini) behind this same interface with zero change to the handler. The
 * contract is deliberately PII-free: certificate number, verdict, and failed rule ids only.
 *
 * <p>Implementations signal failure by throwing (any {@code RuntimeException}); the caller owns the
 * failure policy (mark FAILED, never retry into the verdict path).
 */
public interface ExplanationProvider {

    /**
     * Render the explanation for a frozen decision.
     *
     * @param certificateNumber the decision's certificate number (correlation only, never content)
     * @param verdict           the composed verdict the prose must restate
     * @param failedRuleIds     ids of the rules that failed (empty for a clean PASS)
     * @return the rendered prose plus which provider produced it
     */
    Explanation explain(String certificateNumber, Verdict verdict, List<String> failedRuleIds);

    /**
     * A rendered explanation.
     *
     * @param provider identifier of the generation path (e.g. {@code stub-canned-v1}), stamped into
     *                 the record so a reader knows what produced the text
     * @param text     the plain-language prose
     */
    record Explanation(String provider, String text) {
        public Explanation {
            Objects.requireNonNull(provider, "provider");
            Objects.requireNonNull(text, "text");
        }
    }
}
