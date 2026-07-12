package com.treyi.suitabilitygate.gateway;

import java.time.LocalDate;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.treyi.suitabilitygate.customerdata.CustomerDirectory;
import com.treyi.suitabilitygate.customerdata.CustomerProfile;
import com.treyi.suitabilitygate.gateway.security.AuthPrincipal;
import com.treyi.suitabilitygate.suitability.DecisionLedger;
import com.treyi.suitabilitygate.suitability.DecisionRecord;
import com.treyi.suitabilitygate.suitability.ResourceNotFoundException;

/**
 * HTTP entry point for the customer transparency portal — an investor's read-only view of their OWN
 * record: {@code GET /my/profile} (what the bank knows about them) and {@code GET /my/records} (every
 * suitability decision made in their name, with its full "why").
 *
 * <p><b>Why it exists (the transparency thesis):</b> the bank is a mutual-fund <em>distributor</em>, not
 * an adviser, and the gate never advises. This portal is the customer-facing proof of that: it shows the
 * investor exactly what data drove each decision, which deterministic rule checks fired, the AI's
 * plain-language explanation, and the supervisor's human approval state — and nothing else. There is no
 * product catalogue, no suggestion, no advice-like surface here by design.
 *
 * <p><b>Identity is the token, never the request (§6):</b> both endpoints scope to
 * {@link AuthPrincipal#customerId()} — the customer bound into the verified JWT at login — so a caller can
 * only ever see their own profile and their own decisions; there is no customer id in the path, query, or
 * body to tamper with. A thin BFF (brief §3.1): it holds no business logic, only delegates to the
 * {@link CustomerDirectory} and {@link DecisionLedger} ports. <b>CUSTOMER-only</b>, defense in depth — a
 * {@code SecurityConfig} URL rule <em>and</em> the {@code @PreAuthorize} below (an RM/supervisor gets 403).
 *
 * <p><b>PII discipline (§5):</b> logs reference ids only (customerId, recordId counts) — never the
 * customer's name, income, or DOB, which live only in the sealed ledger and the response body.
 */
@RestController
public class CustomerPortalController {

    private static final Logger log = LoggerFactory.getLogger(CustomerPortalController.class);

    private final CustomerDirectory customers;
    private final DecisionLedger ledger;

    public CustomerPortalController(CustomerDirectory customers, DecisionLedger ledger) {
        this.customers = customers;
        this.ledger = ledger;
    }

    /**
     * The caller's own canonical profile — "what the bank knows about me".
     *
     * <p>Resolved for the token's customer as of today (age-derived fields are computed as-of a date; see
     * {@link CustomerDirectory#findProfile}). A missing profile is a 404 rather than an empty body, so a
     * stale/unknown binding fails loudly instead of rendering a blank portal.
     *
     * @param customer the authenticated investor, from the JWT (its {@code customerId} is the only scope)
     * @return the customer's canonical profile
     * @throws ResourceNotFoundException (404) if no profile resolves for the token's customer id
     */
    @GetMapping("/my/profile")
    @PreAuthorize("hasRole('CUSTOMER')")
    public CustomerProfile myProfile(@AuthenticationPrincipal AuthPrincipal customer) {
        log.debug("Profile request for customer={}", customer.customerId());
        return customers.findProfile(customer.customerId(), LocalDate.now())
                .orElseThrow(() -> ResourceNotFoundException.customer(customer.customerId()));
    }

    /**
     * Every suitability decision made in the caller's name, newest first — each with its rule checks, the
     * AI explanation prose (stitched by {@link DecisionLedger#findByCustomerId}), and the supervisor's
     * approval state. The investor's audit trail, shown to the investor.
     *
     * @param customer the authenticated investor, from the JWT (its {@code customerId} is the only scope)
     * @return that customer's decisions, newest first (possibly empty, never null)
     */
    @GetMapping("/my/records")
    @PreAuthorize("hasRole('CUSTOMER')")
    public List<DecisionRecord> myRecords(@AuthenticationPrincipal AuthPrincipal customer) {
        List<DecisionRecord> records = ledger.findByCustomerId(customer.customerId());
        log.debug("Records request for customer={}: {} decision(s)", customer.customerId(), records.size());
        return records;
    }
}
