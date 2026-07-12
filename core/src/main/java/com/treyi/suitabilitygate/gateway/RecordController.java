package com.treyi.suitabilitygate.gateway;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PostAuthorize;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import com.treyi.suitabilitygate.suitability.DecisionLedger;
import com.treyi.suitabilitygate.suitability.DecisionRecord;
import com.treyi.suitabilitygate.suitability.ResourceNotFoundException;

/**
 * HTTP entry point for reading frozen decisions — a single record ({@code GET /records/{id}}) and the
 * whole-ledger list ({@code GET /records}).
 *
 * <p>A thin BFF wrapper over the {@link DecisionLedger} port (brief §3.1); no business logic beyond access
 * control. Per the Access Control Matrix (CLAUDE.md §6):
 * <ul>
 *   <li><b>{@code GET /records/{id}}</b> — both roles authenticated in, but an RM may only read their own
 *       records (the {@code rmId} frozen into {@link DecisionRecord#proposal()} at evaluation time) while
 *       compliance reads any — enforced via {@code @PostAuthorize} since ownership is only known post-fetch.</li>
 *   <li><b>{@code GET /records}</b> (the compliance dashboard's whole-ledger read) — <b>COMPLIANCE-only</b>:
 *       it crosses every RM's records, so an RM has no ownership scope over it. Gated in depth — a
 *       {@code SecurityConfig} URL rule <em>and</em> the {@code @PreAuthorize} below (RM → 403).</li>
 * </ul>
 */
@RestController
public class RecordController {

    private final DecisionLedger ledger;

    public RecordController(DecisionLedger ledger) {
        this.ledger = ledger;
    }

    @GetMapping("/records/{id}")
    @PreAuthorize("hasAnyRole('RM', 'COMPLIANCE')")
    @PostAuthorize("hasRole('COMPLIANCE') or returnObject.proposal().rmId() == principal.username()")
    public DecisionRecord findById(@PathVariable UUID id) {
        return ledger.findById(id).orElseThrow(() -> ResourceNotFoundException.record(id));
    }

    /**
     * The whole ledger, newest first — feeds the compliance dashboard. COMPLIANCE-only (see class doc):
     * this read crosses every RM's records, so it is not scoped by ownership the way {@link #findById} is.
     *
     * @return every frozen decision, newest first (without the async explanation overlay — see
     *         {@link DecisionLedger#findAll()})
     */
    @GetMapping("/records")
    @PreAuthorize("hasRole('COMPLIANCE')")
    public List<DecisionRecord> findAll() {
        return ledger.findAll();
    }
}
