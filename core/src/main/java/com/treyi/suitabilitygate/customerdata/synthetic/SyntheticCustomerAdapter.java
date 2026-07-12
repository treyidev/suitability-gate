package com.treyi.suitabilitygate.customerdata.synthetic;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.treyi.suitabilitygate.customerdata.CustomerDirectory;
import com.treyi.suitabilitygate.customerdata.CustomerProfile;
import com.treyi.suitabilitygate.customerdata.KycStatus;
import com.treyi.suitabilitygate.shared.RiskCategory;
import com.treyi.suitabilitygate.shared.SourceSystem;

/**
 * Synthetic implementation of {@link CustomerDirectory} — the demo data source.
 *
 * <p><b>The adapter does real translation work.</b> The seed ({@link SourceCustomer}) is shaped like a
 * messy bank export: cryptic single-letter risk/KYC codes, ISO date strings, and legitimately missing
 * incomes. {@link #toCanonical} maps that into the canonical {@link CustomerProfile} — exactly the work
 * a real {@code IdbiCustomerAdapter} will do. Nothing source-shaped escapes this class.
 *
 * <p>Ids are fixed (not random) so personas are stable across restarts and referenceable by the
 * frontend and golden scenarios.
 */
@Component
public class SyntheticCustomerAdapter implements CustomerDirectory {

    // Stable persona ids (also referenced by seed narrative / golden scenarios).
    public static final UUID SHARMA = UUID.fromString("c0000000-0000-0000-0000-000000000001");
    public static final UUID ROHAN = UUID.fromString("c0000000-0000-0000-0000-000000000002");
    public static final UUID PRIYA = UUID.fromString("c0000000-0000-0000-0000-000000000003");
    public static final UUID ANIL = UUID.fromString("c0000000-0000-0000-0000-000000000004");
    public static final UUID SUNITA = UUID.fromString("c0000000-0000-0000-0000-000000000005");
    public static final UUID VIKRAM = UUID.fromString("c0000000-0000-0000-0000-000000000006");
    // Fresh personas (owner-directed 2026-07-12 for the RM Prospects co-pilot): no seeded ledger history,
    // so they surface as un-served "fresh" rows; varied age/risk/horizon so each yields a distinct plan.
    public static final UUID KAVYA = UUID.fromString("c0000000-0000-0000-0000-000000000007");
    public static final UUID ARJUN = UUID.fromString("c0000000-0000-0000-0000-000000000008");
    public static final UUID FARHAN = UUID.fromString("c0000000-0000-0000-0000-000000000009");
    public static final UUID MEERA = UUID.fromString("c0000000-0000-0000-0000-00000000000a");

    /**
     * The messy source records. Field names/codes mimic a real export; translation happens in
     * {@link #toCanonical}. Personas: Sharma (golden 1 headline FLAG), Rohan (golden 2 clean PASS),
     * Priya (golden 4 horizon/ELSS), plus three unremarkable fillers (Priya & Sunita have null income),
     * then four "fresh" personas (Kavya, Arjun, Farhan, Meera) with no seeded ledger history — the RM
     * Prospects co-pilot's un-served rows, each varied so it yields a distinct gate-passing plan.
     */
    private final List<SourceCustomer> source = List.of(
            new SourceCustomer(SHARMA, "Sunita Sharma", "1954-03-01", "C", "2025-01-06",
                    800_000L, 5_000_000L, 120, "V", "2025-01-06", "PUNE-01"),
            new SourceCustomer(ROHAN, "Rohan Mehta", "1992-06-15", "A", "2025-11-20",
                    2_400_000L, 3_500_000L, 96, "V", "2025-11-20", "MUM-01"),
            new SourceCustomer(PRIYA, "Priya Nair", "1986-01-20", "A", "2026-02-10",
                    null, 1_200_000L, 20, "V", "2026-02-10", "BLR-01"),
            new SourceCustomer(ANIL, "Anil Kumar", "1981-05-10", "M", "2025-07-01",
                    1_500_000L, 2_000_000L, 60, "V", "2025-07-01", "DEL-01"),
            new SourceCustomer(SUNITA, "Sunita Rao", "1974-02-25", "M", "2023-04-15",
                    null, 900_000L, 84, "S", "2023-04-15", "BLR-01"),
            new SourceCustomer(VIKRAM, "Vikram Singh", "1988-09-05", "A", "2025-09-30",
                    1_800_000L, 2_600_000L, 120, "V", "2025-09-30", "MUM-01"),
            // Fresh personas (no seeded decisions) — the RM Prospects co-pilot's un-served rows.
            new SourceCustomer(KAVYA, "Kavya Reddy", "1997-04-12", "A", "2026-01-15",
                    1_800_000L, 2_500_000L, 96, "V", "2026-01-15", "MUM-01"),
            new SourceCustomer(ARJUN, "Arjun Desai", "1974-03-20", "M", "2025-10-05",
                    3_000_000L, 6_000_000L, 120, "V", "2025-10-05", "PUNE-01"),
            new SourceCustomer(FARHAN, "Farhan Sheikh", "1985-03-15", "M", "2025-12-01",
                    1_200_000L, 1_800_000L, 48, "V", "2025-12-01", "DEL-01"),
            new SourceCustomer(MEERA, "Meera Iyer", "1991-01-30", "C", "2026-03-20",
                    900_000L, 1_100_000L, 24, "V", "2026-03-20", "BLR-01"));

    @Override
    public Optional<CustomerProfile> findProfile(UUID customerId, LocalDate asOf) {
        return source.stream()
                .filter(raw -> raw.custId().equals(customerId))
                .findFirst()
                .map(raw -> toCanonical(raw, asOf));
    }

    @Override
    public List<CustomerProfile> findAll(LocalDate asOf) {
        return source.stream().map(raw -> toCanonical(raw, asOf)).toList();
    }

    /** Translate one messy source record into the canonical profile (derives age/senior as of {@code asOf}). */
    private CustomerProfile toCanonical(SourceCustomer raw, LocalDate asOf) {
        return CustomerProfile.of(
                raw.custId(),
                raw.fullName(),
                LocalDate.parse(raw.dob()),
                mapRisk(raw.riskCode()),
                LocalDate.parse(raw.riskProfileDate()),
                raw.annualIncome(),
                raw.investableAssets(),
                raw.horizonMonths(),
                mapKyc(raw.kycCode()),
                LocalDate.parse(raw.kycDate()),
                raw.branch(),
                SourceSystem.SYNTHETIC,
                asOf);
    }

    private static RiskCategory mapRisk(String code) {
        return switch (code) {
            case "C" -> RiskCategory.CONSERVATIVE;
            case "M" -> RiskCategory.MODERATE;
            case "A" -> RiskCategory.AGGRESSIVE;
            default -> throw new IllegalArgumentException("Unknown source risk code: " + code);
        };
    }

    private static KycStatus mapKyc(String code) {
        return switch (code) {
            case "V" -> KycStatus.VERIFIED;
            case "S" -> KycStatus.STALE;
            case "P" -> KycStatus.PENDING;
            default -> throw new IllegalArgumentException("Unknown source KYC code: " + code);
        };
    }

    /**
     * A record in the synthetic source's own (messy) schema — cryptic codes, string dates, nullable
     * money fields. Deliberately NOT the canonical model; {@link #toCanonical} bridges the two.
     */
    private record SourceCustomer(
            UUID custId,
            String fullName,
            String dob,
            String riskCode,
            String riskProfileDate,
            Long annualIncome,
            Long investableAssets,
            Integer horizonMonths,
            String kycCode,
            String kycDate,
            String branch) {
    }
}
