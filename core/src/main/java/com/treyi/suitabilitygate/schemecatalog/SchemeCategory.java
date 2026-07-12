package com.treyi.suitabilitygate.schemecatalog;

/**
 * Canonical mutual-fund scheme category. Owned by Scheme Catalog (not the shared kernel) because it is
 * scheme-specific vocabulary consumed through {@link Scheme}.
 *
 * <p>{@code EQUITY_ELSS} carries a statutory 36-month lock-in — the case the {@code HORIZON_LOCKIN}
 * rule is built around — though lock-in is read from {@link Scheme#lockInMonths()}, not inferred here.
 */
public enum SchemeCategory {
    EQUITY_SMALL_CAP,
    EQUITY_MID_CAP,
    EQUITY_LARGE_CAP,
    EQUITY_ELSS,
    HYBRID,
    DEBT_SHORT,
    DEBT_LONG,
    LIQUID,
    INDEX
}
