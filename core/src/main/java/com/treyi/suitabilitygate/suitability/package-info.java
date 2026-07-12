/**
 * Suitability module — the rules engine and the staged evaluation pipeline.
 *
 * <h2>Why this module exists</h2>
 * This is the <em>only</em> module that holds business logic. It runs the deterministic
 * suitability rules and the staged pipeline (Resolve &rarr; Evaluate &rarr; Record) that
 * turns a proposed transaction into a frozen decision. It embodies the core thesis:
 * <strong>guarantees in code, judgment in the model</strong> — every verdict is produced
 * here by deterministic code, never by an LLM.
 *
 * <h2>Where it fits</h2>
 * <ul>
 *   <li><b>Upstream:</b> invoked by {@code gateway} on {@code POST /evaluations}.</li>
 *   <li><b>Reads:</b> {@code customerdata} and {@code schemecatalog} (via their published APIs only).</li>
 *   <li><b>Writes:</b> hands the frozen record to {@code decisionrecord} — the sole writer of the ledger.</li>
 *   <li><b>Downstream (async):</b> publishes {@code DecisionRecordedEvent}; the explanation is rendered
 *       off the critical path so verdict latency stays at rules-engine latency.</li>
 * </ul>
 * This module is <strong>stateless</strong> and owns no persistent data.
 *
 * <h2>Limitations &amp; evolution</h2>
 * <ul>
 *   <li><b>SAFE EXTENSIONS:</b> adding a rule is dropping in one {@code SuitabilityRule} bean;
 *       adding a pipeline capability is a new stage class + registration. The orchestrator body
 *       is untouched by either.</li>
 *   <li><b>REGRESSIONS TO AVOID:</b> do not create a second orchestrator; do not let a rule reach a
 *       data source directly (rules read only from the shared evaluation context); do not let any
 *       explanation/LLM output influence a verdict, number, or outcome.</li>
 * </ul>
 */
@ApplicationModule(displayName = "Suitability")
package com.treyi.suitabilitygate.suitability;

import org.springframework.modulith.ApplicationModule;
