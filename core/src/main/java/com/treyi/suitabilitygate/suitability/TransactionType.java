package com.treyi.suitabilitygate.suitability;

/**
 * Mode of a proposed purchase. Owned by Suitability because it qualifies the {@link ProposedTransaction}
 * input, not any stored entity.
 *
 * <ul>
 *   <li>{@code LUMPSUM} — a single one-off investment (the amount the income-proportionality check weighs).</li>
 *   <li>{@code SIP} — a recurring systematic investment plan.</li>
 * </ul>
 */
public enum TransactionType {
    LUMPSUM,
    SIP
}
