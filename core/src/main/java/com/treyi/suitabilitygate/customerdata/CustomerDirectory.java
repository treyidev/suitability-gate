package com.treyi.suitabilitygate.customerdata;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Port for sourcing canonical customer profiles — the seam behind which data sources plug in.
 *
 * <p><b>Why a port:</b> the engine and pipeline depend only on this interface and the canonical
 * {@link CustomerProfile}, never on a concrete source. Today {@code SyntheticCustomerAdapter} backs it;
 * connecting IDBI's real systems is one new adapter class ({@code IdbiCustomerAdapter}) implementing
 * this port, with zero change upstream ("synthetic now, IDBI later").
 *
 * <p>Age-derived fields depend on the evaluation date, so read operations take an {@code asOf} date:
 * the profile is materialised as of that moment and frozen into the DecisionRecord.
 */
public interface CustomerDirectory {

    /**
     * Resolve a single customer's canonical profile as of the given date.
     *
     * @param customerId canonical customer id
     * @param asOf       date the age-derived fields are computed against (usually the evaluation date)
     * @return the profile, or empty if no such customer
     */
    Optional<CustomerProfile> findProfile(UUID customerId, LocalDate asOf);

    /**
     * All known customers as canonical profiles, as of the given date (for the RM customer picker).
     *
     * @param asOf date the age-derived fields are computed against
     * @return all profiles (never null; possibly empty)
     */
    List<CustomerProfile> findAll(LocalDate asOf);
}
