package com.treyi.suitabilitygate.suitability;

/**
 * Lifecycle of the (downstream, async) LLM explanation attached to a decision.
 *
 * <p>The verdict never waits on this — it is {@code PENDING} the moment the record is frozen, and the
 * async handler (explanation module) later attaches prose ({@code ATTACHED}) or records failure
 * ({@code FAILED}). In Phase 1 the prose is canned text from the stub explanation service (owner
 * decision 2026-07-11: the full seam runs end to end); Gemini is not wired.
 */
public enum ExplanationStatus {
    PENDING,
    ATTACHED,
    FAILED
}
