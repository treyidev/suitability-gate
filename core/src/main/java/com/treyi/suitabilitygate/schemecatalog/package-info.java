/**
 * Scheme Catalog module — canonical mutual-fund scheme data behind ports/adapters.
 *
 * <h2>Why this module exists</h2>
 * Owns the canonical {@code Scheme} model (category, riskometer level, lock-in, volatility class,
 * minimums) and the port that sources it. Kept separate from {@code customerdata} because the real
 * upstreams are different systems (AMC / product feeds vs CRM / core banking), so they evolve and
 * fail independently.
 *
 * <h2>Where it fits</h2>
 * <ul>
 *   <li><b>Upstream:</b> read by {@code suitability} (stage 2) and by {@code gateway} for the scheme picker.</li>
 * </ul>
 * Owns no persistent data — data is adapter-backed. Reads are cache-friendly (schemes change rarely).
 *
 * <h2>Limitations &amp; evolution</h2>
 * <ul>
 *   <li><b>SAFE EXTENSIONS:</b> a new source is one new adapter implementing the port; a Caffeine cache
 *       can sit in front of scheme reads without touching callers.</li>
 *   <li><b>REGRESSIONS TO AVOID:</b> do not leak a source-specific scheme code shape past the adapter;
 *       do not let {@code suitability} interpret raw source categories — it reads only the canonical enum.</li>
 * </ul>
 */
@ApplicationModule(displayName = "Scheme Catalog")
package com.treyi.suitabilitygate.schemecatalog;

import org.springframework.modulith.ApplicationModule;
