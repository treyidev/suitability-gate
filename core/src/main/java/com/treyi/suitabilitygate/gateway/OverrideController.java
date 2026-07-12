package com.treyi.suitabilitygate.gateway;

import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.treyi.suitabilitygate.gateway.security.AuthPrincipal;
import com.treyi.suitabilitygate.suitability.DecisionLedger;
import com.treyi.suitabilitygate.suitability.OverrideEvent;

/**
 * HTTP entry point for a supervisor's mandatory human decision on a decision — {@code POST
 * /evaluations/{id}/override} (brief §6.1, D11). Humans are always in the loop: deterministic code makes the
 * verdict; a human always approves or rejects before the transaction is final — no auto-execution.
 *
 * <p>A thin BFF wrapper over the {@link DecisionLedger} port (brief §3.1). <b>COMPLIANCE-only</b>, defense
 * in depth: a {@code SecurityConfig} URL rule <em>and</em> the {@code @PreAuthorize} below — an RM gets 403
 * (the brief's demo moment). The supervisor's identity ({@code overriddenBy}) is taken from the verified
 * {@link AuthPrincipal} (the token), never the request body, so the audit record's reviewer is the one who
 * logged in. The ledger enforces the rules (record must exist → 404, not already decided → 409) and appends
 * the event; the frozen decision is never mutated.
 */
@RestController
public class OverrideController {

    private static final Logger log = LoggerFactory.getLogger(OverrideController.class);

    private final DecisionLedger ledger;

    public OverrideController(DecisionLedger ledger) {
        this.ledger = ledger;
    }

    /**
     * Record a supervisor's human decision (approve or reject) on a decision.
     *
     * @param id         the record id being decided (path)
     * @param request    the decision outcome + mandatory justification (identity is NOT here — it's the token's)
     * @param supervisor the authenticated compliance user, from the JWT
     * @return the appended {@link OverrideEvent}
     */
    @PostMapping("/evaluations/{id}/override")
    @PreAuthorize("hasRole('COMPLIANCE')")
    public OverrideEvent override(@PathVariable UUID id, @RequestBody OverrideRequest request,
            @AuthenticationPrincipal AuthPrincipal supervisor) {
        log.debug("Override request record={} action={} by={}", id, request.action(), supervisor.username());
        return ledger.attachOverride(id, request.action(), request.justification(), supervisor.username());
    }
}
