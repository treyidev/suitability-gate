/**
 * Customer Data module — canonical customer profiles and holdings behind ports/adapters.
 *
 * <h2>Why this module exists</h2>
 * Owns the canonical {@code CustomerProfile} and {@code Holdings} models and the ports that
 * source them. The synthetic adapter translates a deliberately messy, bank-export-shaped source
 * schema (stale KYC dates, null incomes, cryptic codes) into the canonical model — the same
 * translation work a real IDBI adapter will do. Neither synthetic nor IDBI schemas leak past an
 * adapter. Also owns capability flags (e.g. {@code holdingsAvailable}) so rules can degrade
 * gracefully when a source cannot supply data.
 *
 * <h2>Where it fits</h2>
 * <ul>
 *   <li><b>Upstream:</b> read by {@code suitability} (stage 1) and by {@code gateway} for UI convenience.</li>
 *   <li><b>Separate from {@code schemecatalog}</b> because real upstreams differ (CRM / core banking
 *       vs AMC feeds).</li>
 * </ul>
 * Owns no persistent data — data is adapter-backed.
 *
 * <h2>Limitations &amp; evolution</h2>
 * <ul>
 *   <li><b>SAFE EXTENSIONS:</b> a new source is one new adapter implementing the port
 *       ({@code IdbiCustomerAdapter}); no engine change.</li>
 *   <li><b>REGRESSIONS TO AVOID:</b> do not expose a source-specific field on the canonical model;
 *       do not let a caller depend on which adapter is active.</li>
 * </ul>
 */
@ApplicationModule(displayName = "Customer Data")
package com.treyi.suitabilitygate.customerdata;

import org.springframework.modulith.ApplicationModule;
