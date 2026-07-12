package com.treyi.suitabilitygate.customerdata;

import java.time.LocalDate;
import java.time.Period;
import java.util.Objects;
import java.util.UUID;

import com.treyi.suitabilitygate.shared.RiskCategory;
import com.treyi.suitabilitygate.shared.SourceSystem;

/**
 * Canonical customer profile — the bank's source-agnostic view of an investor.
 *
 * <p><b>Snapshot semantics:</b> an instance is a point-in-time snapshot. A full copy is embedded in
 * every DecisionRecord (locked decision D12) so a decision can be replayed exactly as it was made —
 * no joins on read, perfect "what did you know then" reconstruction.
 *
 * <p><b>Nullable fields</b> ({@code annualIncomeInr}, {@code investableAssetsInr},
 * {@code investmentHorizonMonths}) model realistic messiness in bank exports. Rules that need a missing
 * input record SKIPPED rather than guessing — the gap is auditable, not silently filled.
 *
 * <p><b>Derived fields</b> {@code ageYears} and {@code seniorCitizen} are computed as of the evaluation
 * date and frozen into the snapshot; prefer {@link #of} to derive them consistently from date of birth.
 *
 * @param customerId              stable canonical id
 * @param fullName                display name
 * @param dateOfBirth             birth date (source of the derived age)
 * @param ageYears                age in whole years as of evaluation (derived, frozen into the snapshot)
 * @param riskCategory            stated risk tolerance from the questionnaire
 * @param riskProfileDate         when the questionnaire was taken (drives KYC/profile freshness checks)
 * @param annualIncomeInr         declared annual income in INR, or null if not on file
 * @param investableAssetsInr     declared investable assets in INR, or null if not on file
 * @param investmentHorizonMonths stated general investment horizon in months, or null if unknown
 * @param kycStatus               KYC verification state
 * @param kycLastUpdated          last KYC update date
 * @param seniorCitizen           derived: {@code ageYears >= }{@value #SENIOR_CITIZEN_AGE_YEARS}
 * @param branchCode              originating branch (e.g. {@code PUNE-01})
 * @param sourceSystem            provenance of this record
 */
public record CustomerProfile(
        UUID customerId,
        String fullName,
        LocalDate dateOfBirth,
        int ageYears,
        RiskCategory riskCategory,
        LocalDate riskProfileDate,
        Long annualIncomeInr,
        Long investableAssetsInr,
        Integer investmentHorizonMonths,
        KycStatus kycStatus,
        LocalDate kycLastUpdated,
        boolean seniorCitizen,
        String branchCode,
        SourceSystem sourceSystem) {

    /** India's statutory senior-citizen age; drives the derived {@link #seniorCitizen()} flag (§5). */
    public static final int SENIOR_CITIZEN_AGE_YEARS = 60;

    /** Fail-fast on missing required fields; the three {@code *Inr}/horizon fields may legitimately be null. */
    public CustomerProfile {
        Objects.requireNonNull(customerId, "customerId");
        Objects.requireNonNull(fullName, "fullName");
        Objects.requireNonNull(dateOfBirth, "dateOfBirth");
        Objects.requireNonNull(riskCategory, "riskCategory");
        Objects.requireNonNull(riskProfileDate, "riskProfileDate");
        Objects.requireNonNull(kycStatus, "kycStatus");
        Objects.requireNonNull(kycLastUpdated, "kycLastUpdated");
        Objects.requireNonNull(branchCode, "branchCode");
        Objects.requireNonNull(sourceSystem, "sourceSystem");
    }

    /**
     * Builds a profile deriving {@code ageYears} and {@code seniorCitizen} from date of birth as of the
     * given evaluation date. Adapters use this so the derived values are always consistent with the DOB
     * and the moment the decision was made.
     *
     * @param asOf the evaluation date the age is computed against; must not be null
     * @return a profile with derived age fields populated
     */
    public static CustomerProfile of(
            UUID customerId,
            String fullName,
            LocalDate dateOfBirth,
            RiskCategory riskCategory,
            LocalDate riskProfileDate,
            Long annualIncomeInr,
            Long investableAssetsInr,
            Integer investmentHorizonMonths,
            KycStatus kycStatus,
            LocalDate kycLastUpdated,
            String branchCode,
            SourceSystem sourceSystem,
            LocalDate asOf) {
        Objects.requireNonNull(dateOfBirth, "dateOfBirth");
        Objects.requireNonNull(asOf, "asOf");
        int derivedAge = Period.between(dateOfBirth, asOf).getYears();
        boolean derivedSenior = derivedAge >= SENIOR_CITIZEN_AGE_YEARS;
        return new CustomerProfile(customerId, fullName, dateOfBirth, derivedAge, riskCategory,
                riskProfileDate, annualIncomeInr, investableAssetsInr, investmentHorizonMonths, kycStatus,
                kycLastUpdated, derivedSenior, branchCode, sourceSystem);
    }
}
