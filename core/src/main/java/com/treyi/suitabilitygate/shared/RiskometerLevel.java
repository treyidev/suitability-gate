package com.treyi.suitabilitygate.shared;

/**
 * SEBI riskometer levels, in <strong>ascending order of risk</strong>.
 *
 * <p>Declaration order is SIGNIFICANT: it defines the ranking used to test whether a scheme's risk
 * exceeds a permitted cap (see {@link #isAbove(RiskometerLevel)}). This level appears on both schemes
 * (Scheme Catalog) and holdings positions (Customer Data), and is the scale suitability rules compare
 * against age-band and stated-risk caps.
 */
public enum RiskometerLevel {
    LOW,
    LOW_TO_MODERATE,
    MODERATE,
    MODERATELY_HIGH,
    HIGH,
    VERY_HIGH;

    /**
     * Whether this level ranks strictly above the given cap — the core "scheme too risky for the
     * permitted band" test. Centralised here so no rule hand-rolls an ordinal comparison.
     *
     * @param cap the maximum permitted level (inclusive); must not be null
     * @return true if this level exceeds {@code cap}
     */
    public boolean isAbove(RiskometerLevel cap) {
        return this.ordinal() > cap.ordinal();
    }
}
