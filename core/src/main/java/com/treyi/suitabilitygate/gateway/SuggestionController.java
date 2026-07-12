package com.treyi.suitabilitygate.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.treyi.suitabilitygate.gateway.security.AuthPrincipal;
import com.treyi.suitabilitygate.suitability.PlanProposer;

/**
 * HTTP entry point for the RM co-pilot's plan suggestion — {@code POST /suggestions} (role-gated to
 * {@code ROLE_RM}; a supervisor gets 403).
 *
 * <p>A thin BFF over the {@link PlanProposer} port: the RM identity comes from the authenticated token
 * (used only to form the ephemeral screening proposals — nothing is persisted), never from the body. The
 * suggestion is advisory; it writes no ledger record and produces no verdict — the RM accepts/edits it and
 * the deterministic gate adjudicates only on Submit.
 */
@RestController
public class SuggestionController {

    private static final Logger log = LoggerFactory.getLogger(SuggestionController.class);

    private final PlanProposer proposer;

    public SuggestionController(PlanProposer proposer) {
        this.proposer = proposer;
    }

    /**
     * Suggest a suitable plan for a customer, or report that none clears the gate.
     *
     * @param request the customer to propose for
     * @param rm      the authenticated relationship manager, from the JWT
     * @return the suggested plan, or an "available: false" response when nothing passes
     */
    @PostMapping("/suggestions")
    @PreAuthorize("hasRole('RM')")
    public PlanSuggestionResponse suggest(@RequestBody SuggestionRequest request,
            @AuthenticationPrincipal AuthPrincipal rm) {
        log.debug("Suggestion request by rm={} branch={}: customer={}",
                rm.username(), rm.branchCode(), request.customerId());
        return proposer.propose(request.customerId(), rm.username(), rm.branchCode())
                .map(PlanSuggestionResponse::of)
                .orElseGet(PlanSuggestionResponse::none);
    }
}
