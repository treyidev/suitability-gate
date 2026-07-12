package com.treyi.suitabilitygate.suitability;

/**
 * The outcome of a supervisor's mandatory human decision on a decision record (the {@code resultingStatus},
 * brief §6.1, generalised).
 *
 * <p><b>Humans always in the loop (owner directive 2026-07-12):</b> no transaction is finalised by the
 * machine alone. The deterministic rules + AI only <em>screen and explain</em>; a human always makes the
 * final approval, with a mandatory justification — the safety backstop against a rule gap, bad input data,
 * or (in Phase 2, when AI signals feed in as inputs) a hallucinated signal. So EVERY decision — PASS or
 * FLAGGED — requires one of these outcomes before it is final:
 *
 * <ul>
 *   <li>{@link #APPROVED} — the human lets the transaction proceed. On a FLAGGED decision this is an
 *       <em>override</em> of the flag (brief §6.1's original {@code OVERRIDE_APPROVED}); on a PASS it is a
 *       confirmation.</li>
 *   <li>{@link #REJECTED} — the human blocks the transaction. On a FLAGGED decision this <em>upholds</em>
 *       the flag; on a PASS it is a human catching what the rules did not.</li>
 * </ul>
 *
 * <p>SAFE EXTENSION: further outcomes (e.g. {@code ESCALATED}) drop in here. REGRESSION TO AVOID: never an
 * outcome that mutates the frozen verdict — a decision is an appended event, never an edit.
 */
public enum OverrideStatus {
    /** The human approved the transaction — it may proceed (an override, on a FLAGGED decision). */
    APPROVED,
    /** The human rejected the transaction — it is blocked (upholding the flag, on a FLAGGED decision). */
    REJECTED
}
