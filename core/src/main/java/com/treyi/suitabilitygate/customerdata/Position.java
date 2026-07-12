package com.treyi.suitabilitygate.customerdata;

import java.util.Objects;
import java.util.UUID;

import com.treyi.suitabilitygate.shared.RiskometerLevel;

/**
 * A single holding within a customer's portfolio.
 *
 * <p>{@code schemeCategory} is intentionally a free-text {@code String} here (not the
 * {@code SchemeCategory} enum): per §5.2 the holdings feed is a separate, coarser upstream than the
 * scheme catalog and may report categories the catalog does not model. Rules that reason over holdings
 * use {@link #riskometerLevel()} and value, not this label.
 *
 * @param schemeId        canonical scheme id of the held position
 * @param schemeCategory  category as reported by the holdings source (free-text; see note above)
 * @param riskometerLevel risk level of the held scheme
 * @param currentValueInr current market value of the position in INR
 */
public record Position(
        UUID schemeId,
        String schemeCategory,
        RiskometerLevel riskometerLevel,
        long currentValueInr) {

    public Position {
        Objects.requireNonNull(schemeId, "schemeId");
        Objects.requireNonNull(schemeCategory, "schemeCategory");
        Objects.requireNonNull(riskometerLevel, "riskometerLevel");
    }
}
