package com.treyi.suitabilitygate.shared;

/**
 * Derived volatility bucket for a scheme, in ascending order.
 *
 * <p>A coarser signal than {@link RiskometerLevel}, used by the senior-citizen composite check and
 * (in Phase 2) the concentration check.
 */
public enum VolatilityClass {
    LOW,
    MEDIUM,
    HIGH
}
