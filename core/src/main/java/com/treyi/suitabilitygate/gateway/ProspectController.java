package com.treyi.suitabilitygate.gateway;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.treyi.suitabilitygate.gateway.security.AuthPrincipal;
import com.treyi.suitabilitygate.suitability.Prospect;
import com.treyi.suitabilitygate.suitability.ProspectFinder;

/**
 * HTTP entry point for the RM "Prospects" co-pilot — {@code GET /prospects} (role-gated to {@code ROLE_RM};
 * a supervisor gets 403).
 *
 * <p>A thin BFF over {@link ProspectFinder}: the RM identity comes from the authenticated token (used only
 * to form the ephemeral screening proposals — nothing is persisted), never from the request. Returns the
 * advisory worklist — customers each paired with a gate-passing suggested plan and an "already served"
 * flag. It writes no ledger record and produces no verdict; the RM acts on a row through the normal
 * Evaluate → Submit flow, which the deterministic gate adjudicates. Gated in depth: the URL rule in
 * {@code SecurityConfig} AND the {@code @PreAuthorize} here (CLAUDE.md §6 Access Control Matrix).
 */
@RestController
public class ProspectController {

    private static final Logger log = LoggerFactory.getLogger(ProspectController.class);

    private final ProspectFinder finder;

    public ProspectController(ProspectFinder finder) {
        this.finder = finder;
    }

    /**
     * The RM's prospect worklist — customers with a suitable, gate-passing suggested plan, fresh-first.
     *
     * @param rm the authenticated relationship manager, from the JWT
     * @return the advisory prospect rows (never null; empty if none have a passing plan)
     */
    @GetMapping("/prospects")
    @PreAuthorize("hasRole('RM')")
    public List<Prospect> findProspects(@AuthenticationPrincipal AuthPrincipal rm) {
        log.debug("Prospect worklist requested by rm={} branch={}", rm.username(), rm.branchCode());
        return finder.findProspects(rm.username(), rm.branchCode());
    }
}
