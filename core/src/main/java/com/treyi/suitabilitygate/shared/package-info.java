/**
 * Shared Kernel — the canonical value vocabulary compared across module boundaries.
 *
 * <h2>Why this module exists</h2>
 * A handful of value types (risk scales, source markers) are genuinely cross-cutting: a scheme's
 * riskometer (owned conceptually by Scheme Catalog) is compared against a customer's stated risk
 * category (owned by Customer Data) by rules (owned by Suitability). Rather than couple those business
 * modules to each other for the sake of an enum, the shared classification vocabulary lives here.
 *
 * <h2>What belongs here</h2>
 * ONLY immutable value types (enums / value records) representing cross-module vocabulary, with no
 * behavior beyond pure classification helpers. No entities, no services, no data ownership.
 *
 * <h2>Modulith type</h2>
 * Declared {@code OPEN} so every module may depend on it; that is its whole purpose. It depends on
 * nothing, so it can never participate in a cycle.
 *
 * <h2>Limitations &amp; evolution</h2>
 * <ul>
 *   <li><b>SAFE EXTENSIONS:</b> add a value type here only once it is compared across two or more modules.</li>
 *   <li><b>REGRESSIONS TO AVOID:</b> do not place module-specific types here — {@code KycStatus} stays in
 *       Customer Data, {@code SchemeCategory} in Scheme Catalog, {@code TransactionType} in Suitability.
 *       The shared kernel is for common vocabulary, not a dumping ground.</li>
 * </ul>
 */
@ApplicationModule(type = ApplicationModule.Type.OPEN, displayName = "Shared Kernel")
package com.treyi.suitabilitygate.shared;

import org.springframework.modulith.ApplicationModule;
