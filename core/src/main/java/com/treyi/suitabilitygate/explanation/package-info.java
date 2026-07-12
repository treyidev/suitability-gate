/**
 * Explanation module — the async downstream consumer of frozen decisions (stage 5, locked D6).
 *
 * <h2>Why this module exists</h2>
 * It is the in-process half of the thesis boundary: <strong>guarantees in code, judgment in the
 * model</strong>. Verdicts are made and frozen upstream; this module reacts to
 * {@code DecisionRecordedEvent} strictly afterwards, obtains plain-language prose from the external
 * explanation service (the one Java→Python call, D3), and attaches it back through the ledger port.
 * Nothing here can influence a verdict, a rule outcome, or a number — it runs after the record is
 * immutable, and its only write path is the explanation attachment.
 *
 * <h2>Where it fits</h2>
 * <ul>
 *   <li><b>Upstream:</b> {@code suitability} publishes {@code DecisionRecordedEvent} (fire-and-forget;
 *       the verdict never waits).</li>
 *   <li><b>Downstream:</b> the external Python explanation service, via {@code ExplanationProvider} —
 *       stub canned text in Phase 1, Gemini behind the same port in Phase 2 (D4).</li>
 *   <li><b>Writes:</b> {@code DecisionLedger.attachExplanation(..)} / {@code markExplanationFailed(..)}
 *       — implemented by {@code decisionrecord}; the frozen decision row is never rewritten.</li>
 * </ul>
 * Owns no persistent data.
 *
 * <h2>Limitations &amp; evolution</h2>
 * <ul>
 *   <li><b>Phase-1 delivery semantics:</b> the event is consumed via a plain {@code @Async}
 *       {@code @EventListener} — in-memory, at-most-once. If the process dies between record and
 *       attach, the explanation stays {@code PENDING} (visible, honest, harmless: the decision is
 *       complete without it). Durable redelivery (Modulith event registry +
 *       {@code @ApplicationModuleListener} + the {@code event_publication} table) is the planned
 *       Phase-2 hardening — the same commit that reintroduces {@code spring-modulith-starter-jpa}.</li>
 *   <li><b>SAFE EXTENSIONS:</b> a new provider is one class implementing {@code ExplanationProvider};
 *       richer explanation inputs extend the provider contract, not the handler.</li>
 *   <li><b>REGRESSIONS TO AVOID:</b> never call the provider synchronously from the evaluation path;
 *       never let anything in this module write to a decision beyond the explanation attachment;
 *       never put customer PII into the outbound request (§5 — ids and rule ids only).</li>
 * </ul>
 */
@ApplicationModule(displayName = "Explanation")
package com.treyi.suitabilitygate.explanation;

import org.springframework.modulith.ApplicationModule;
