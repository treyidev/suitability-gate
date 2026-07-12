package com.treyi.suitabilitygate.schemecatalog;

import java.util.Objects;
import java.util.UUID;

import com.treyi.suitabilitygate.shared.RiskometerLevel;
import com.treyi.suitabilitygate.shared.SourceSystem;
import com.treyi.suitabilitygate.shared.VolatilityClass;

/**
 * Canonical mutual-fund scheme — the product side of a proposed transaction.
 *
 * <p><b>Snapshot semantics:</b> a full copy is embedded in every DecisionRecord so the exact product
 * terms judged (riskometer, lock-in) are preserved for replay, even if the scheme later changes.
 *
 * <p>{@code schemeCode} preserves the raw source code (e.g. {@code IDBI-EQ-SC-014}) for traceability;
 * the adapter maps it into the canonical fields. {@code lockInMonths} is 0 when there is no lock-in and
 * 36 for ELSS.
 *
 * @param schemeId         canonical id
 * @param schemeCode       source-system code, preserved verbatim for traceability
 * @param name             display name
 * @param category         canonical category
 * @param riskometerLevel  SEBI riskometer level of the scheme
 * @param lockInMonths     lock-in period in months (0 if none)
 * @param volatilityClass  derived volatility bucket
 * @param minInvestmentInr minimum investment in INR
 * @param sourceSystem     provenance of this record
 */
public record Scheme(
        UUID schemeId,
        String schemeCode,
        String name,
        SchemeCategory category,
        RiskometerLevel riskometerLevel,
        int lockInMonths,
        VolatilityClass volatilityClass,
        long minInvestmentInr,
        SourceSystem sourceSystem) {

    public Scheme {
        Objects.requireNonNull(schemeId, "schemeId");
        Objects.requireNonNull(schemeCode, "schemeCode");
        Objects.requireNonNull(name, "name");
        Objects.requireNonNull(category, "category");
        Objects.requireNonNull(riskometerLevel, "riskometerLevel");
        Objects.requireNonNull(volatilityClass, "volatilityClass");
        Objects.requireNonNull(sourceSystem, "sourceSystem");
        if (lockInMonths < 0) {
            throw new IllegalArgumentException("lockInMonths must be >= 0, was " + lockInMonths);
        }
    }
}
