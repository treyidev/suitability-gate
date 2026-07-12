/**
 * Gateway module — the thin BFF: JWT validation, role gating, routing, single origin for the frontend.
 *
 * <h2>Why this module exists</h2>
 * The one place the outside world enters. It authenticates requests (JWT), gates them by role
 * (ROLE_RM / ROLE_COMPLIANCE / ROLE_CUSTOMER), and routes to the owning module's published API. It
 * carries the caller identity from the token into the audit story (e.g. {@code overriddenBy}) and scopes
 * the customer transparency portal to the token's {@code customerId}. It holds <strong>no business
 * logic</strong> — it delegates.
 *
 * <h2>Where it fits</h2>
 * <ul>
 *   <li><b>Upstream:</b> the React frontend (the only caller).</li>
 *   <li><b>Delegates to:</b> {@code suitability} (evaluations, ledger reads incl. a customer's own
 *       decisions), {@code customerdata} / {@code schemecatalog} (pickers + the customer's own profile),
 *       {@code reporting} (compliance views).</li>
 * </ul>
 * Owns no persistent data.
 *
 * <h2>Limitations &amp; evolution</h2>
 * <ul>
 *   <li><b>SAFE EXTENSIONS:</b> production auth deltas (asymmetric keys/JWKS, bank SSO/IdP, refresh
 *       rotation, mTLS) slot in here without touching the business modules.</li>
 *   <li><b>REGRESSIONS TO AVOID:</b> no rule logic, no verdict composition, and no data ownership may
 *       ever migrate into the gateway; it validates, gates, and routes only.</li>
 * </ul>
 */
@ApplicationModule(displayName = "Gateway")
package com.treyi.suitabilitygate.gateway;

import org.springframework.modulith.ApplicationModule;
