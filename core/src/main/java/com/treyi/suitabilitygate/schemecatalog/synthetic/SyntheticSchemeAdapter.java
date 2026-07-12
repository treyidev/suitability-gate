package com.treyi.suitabilitygate.schemecatalog.synthetic;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.treyi.suitabilitygate.schemecatalog.Scheme;
import com.treyi.suitabilitygate.schemecatalog.SchemeCatalog;
import com.treyi.suitabilitygate.schemecatalog.SchemeCategory;
import com.treyi.suitabilitygate.shared.RiskometerLevel;
import com.treyi.suitabilitygate.shared.SourceSystem;
import com.treyi.suitabilitygate.shared.VolatilityClass;

/**
 * Synthetic implementation of {@link SchemeCatalog} — the demo product data source.
 *
 * <p>Seeds six schemes covering the Phase-1 demo paths, including the {@code EQUITY_SMALL_CAP} /
 * VERY_HIGH fund (Mrs. Sharma's headline FLAG) and the {@code EQUITY_ELSS} / 36-month-lock-in fund
 * (the horizon mismatch). Each keeps its cryptic source {@code schemeCode} — the raw artifact a real
 * AMC feed would carry, preserved for traceability while the canonical fields drive the rules.
 *
 * <p>Ids are fixed so schemes are stable across restarts and referenceable by the frontend and golden
 * scenarios.
 */
@Component
public class SyntheticSchemeAdapter implements SchemeCatalog {

    // Stable scheme ids.
    public static final UUID SMALL_CAP = UUID.fromString("50000000-0000-0000-0000-000000000001");
    public static final UUID LARGE_CAP = UUID.fromString("50000000-0000-0000-0000-000000000002");
    public static final UUID ELSS = UUID.fromString("50000000-0000-0000-0000-000000000003");
    public static final UUID LIQUID = UUID.fromString("50000000-0000-0000-0000-000000000004");
    public static final UUID HYBRID = UUID.fromString("50000000-0000-0000-0000-000000000005");
    public static final UUID SHORT_DEBT = UUID.fromString("50000000-0000-0000-0000-000000000006");

    private final List<Scheme> schemes = List.of(
            new Scheme(SMALL_CAP, "IDBI-EQ-SC-014", "IDBI Emerging Small Cap Fund",
                    SchemeCategory.EQUITY_SMALL_CAP, RiskometerLevel.VERY_HIGH, 0,
                    VolatilityClass.HIGH, 5_000L, SourceSystem.SYNTHETIC),
            new Scheme(LARGE_CAP, "IDBI-EQ-LC-002", "IDBI Bluechip Large Cap Fund",
                    SchemeCategory.EQUITY_LARGE_CAP, RiskometerLevel.MODERATELY_HIGH, 0,
                    VolatilityClass.MEDIUM, 5_000L, SourceSystem.SYNTHETIC),
            new Scheme(ELSS, "IDBI-EL-ELSS-007", "IDBI Long Term Equity (ELSS) Fund",
                    SchemeCategory.EQUITY_ELSS, RiskometerLevel.HIGH, 36,
                    VolatilityClass.HIGH, 500L, SourceSystem.SYNTHETIC),
            new Scheme(LIQUID, "IDBI-DT-LIQ-001", "IDBI Liquid Fund",
                    SchemeCategory.LIQUID, RiskometerLevel.LOW, 0,
                    VolatilityClass.LOW, 1_000L, SourceSystem.SYNTHETIC),
            new Scheme(HYBRID, "IDBI-HY-BAF-021", "IDBI Balanced Advantage Fund",
                    SchemeCategory.HYBRID, RiskometerLevel.MODERATE, 0,
                    VolatilityClass.MEDIUM, 5_000L, SourceSystem.SYNTHETIC),
            new Scheme(SHORT_DEBT, "IDBI-DT-SD-009", "IDBI Short Term Debt Fund",
                    SchemeCategory.DEBT_SHORT, RiskometerLevel.LOW_TO_MODERATE, 0,
                    VolatilityClass.LOW, 5_000L, SourceSystem.SYNTHETIC));

    @Override
    public Optional<Scheme> findById(UUID schemeId) {
        return schemes.stream().filter(scheme -> scheme.schemeId().equals(schemeId)).findFirst();
    }

    @Override
    public List<Scheme> findAll() {
        return schemes;
    }
}
