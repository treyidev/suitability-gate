/**
 * Decision Record module — the append-only ledger and the ONLY owner of persistent data.
 *
 * <h2>Why this module exists</h2>
 * The system of record. Stores immutable {@code DecisionRecord}s and appended {@code OverrideEvent}s
 * (never mutated) that back the 5-year retention and "what did you know then" replay story. Its
 * tamper-evidence claim is structural: history is append-only by construction. Per locked decision
 * D8 this is the <strong>only</strong> module that owns a database (H2 file-backed via Spring Data JPA).
 *
 * <h2>Where it fits</h2>
 * <ul>
 *   <li><b>Sole writer:</b> {@code suitability} (stage 4), via this module's published API only.</li>
 *   <li><b>Readers:</b> {@code gateway} ({@code GET /records/{id}}) and {@code reporting} (projections).</li>
 *   <li><b>Emits:</b> {@code DecisionRecordedEvent} (Modulith application event) after a record is frozen,
 *       consumed asynchronously to attach an explanation.</li>
 * </ul>
 *
 * <h2>Limitations &amp; evolution</h2>
 * <ul>
 *   <li><b>SAFE EXTENSIONS:</b> H2 &rarr; Postgres (partitioned by month) is a datasource change;
 *       Modulith event externalization &rarr; Kafka is a config change. Indexes on
 *       {@code (branch, rmId, createdAt, verdict)} back the compliance queries.</li>
 *   <li><b>REGRESSIONS TO AVOID:</b> never expose a JPA repository or entity outside this module;
 *       never update a frozen record in place (overrides and explanations are appended/attached, not mutated);
 *       no other module may open a datasource.</li>
 * </ul>
 */
@ApplicationModule(displayName = "Decision Record")
package com.treyi.suitabilitygate.decisionrecord;

import org.springframework.modulith.ApplicationModule;
