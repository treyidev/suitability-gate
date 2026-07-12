/**
 * Reporting module — projections of the ledger (dashboards, PDF certificate, JSON export, metrics).
 *
 * <h2>Why this module exists</h2>
 * A renderer family that turns the immutable ledger into views: compliance dashboard aggregates,
 * the PDF suitability certificate, the raw JSON export, and metrics summaries. It reads ONLY from
 * {@code decisionrecord}, which guarantees every rendering reflects decision-time knowledge and the
 * different renderings cannot disagree ("one record, many renderings").
 *
 * <h2>Where it fits</h2>
 * <ul>
 *   <li><b>Reads:</b> {@code decisionrecord} (published API only) — never re-computes a verdict.</li>
 *   <li><b>Upstream:</b> exposed through {@code gateway} to the compliance face of the UI.</li>
 * </ul>
 * Owns no persistent data.
 *
 * <h2>Phase status</h2>
 * <strong>Phase 1: intentional empty stub.</strong> This package exists now so the full module map and
 * {@code ApplicationModules.verify()} reflect the target architecture from day one; its renderers
 * (dashboard summary, PDF via openhtmltopdf, JSON export, metrics) are DEFERRED to Phase 2 per the
 * MVP-slice amendment.
 *
 * <h2>Limitations &amp; evolution</h2>
 * <ul>
 *   <li><b>SAFE EXTENSIONS:</b> a new report is one new renderer reading the ledger — no engine change.</li>
 *   <li><b>REGRESSIONS TO AVOID:</b> reporting must never write the ledger or hold its own copy of
 *       decision data; it projects, it does not persist.</li>
 * </ul>
 */
@ApplicationModule(displayName = "Reporting")
package com.treyi.suitabilitygate.reporting;

import org.springframework.modulith.ApplicationModule;
