package com.treyi.suitabilitygate.schemecatalog;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Port for sourcing canonical schemes — the seam behind which product data sources plug in.
 *
 * <p>Kept separate from the customer port because real upstreams differ (AMC / product feeds vs
 * CRM / core banking). Today {@code SyntheticSchemeAdapter} backs it; a real AMC-feed adapter is one
 * new class implementing this port, upstream untouched.
 */
public interface SchemeCatalog {

    /**
     * Resolve a single scheme by canonical id.
     *
     * @param schemeId canonical scheme id
     * @return the scheme, or empty if unknown
     */
    Optional<Scheme> findById(UUID schemeId);

    /**
     * All known schemes (for the RM scheme picker).
     *
     * @return all schemes (never null; possibly empty)
     */
    List<Scheme> findAll();
}
