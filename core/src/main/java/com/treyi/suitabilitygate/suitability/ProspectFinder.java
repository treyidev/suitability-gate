package com.treyi.suitabilitygate.suitability;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.treyi.suitabilitygate.customerdata.CustomerDirectory;
import com.treyi.suitabilitygate.customerdata.CustomerProfile;

/**
 * Builds the RM "Prospects" co-pilot worklist — every customer for whom some scheme clears the suitability
 * gate, paired with that suggested plan and an "already served" flag.
 *
 * <p><b>Why it lives here (not in the gateway):</b> "which customers can be advised what" is a
 * suitability-domain query — it composes the {@link PlanProposer} (the same deterministic proposer the
 * Evaluate-form co-pilot uses) with the {@link CustomerDirectory} and the {@link DecisionLedger}. The
 * gateway stays a thin BFF ({@code ProspectController}), exactly as {@code SuggestionController} is thin over
 * {@link PlanProposer}. This is a read/compose service, NOT a second pipeline orchestrator — the module's
 * one orchestrator stays {@link EvaluationPipeline} (a regression this module's package-info calls out).
 *
 * <p><b>Thesis, upheld:</b> each row's plan is only ever a product that already PASSES the gate for that
 * customer (the proposer screens the whole catalogue through the real gate). The row is an advisory input —
 * the RM still Evaluates and Submits through the gate, and the supervisor still approves. Nothing here is a
 * verdict, a number of record, or a product judgment shown to a customer.
 *
 * <p><b>Efficiency (why one {@code findAll}, not one lookup per customer):</b> the "already served" set is
 * computed from a single {@link DecisionLedger#findAll()}, collecting the customer ids that appear — so
 * membership is O(1) per customer with no N+1 ledger round-trips and no per-record explanation overlay
 * (which {@code findAll} deliberately skips). At demo scale the per-customer proposer screen dominates, and
 * that is bounded by the small scheme catalogue.
 *
 * <p>Logging (§5): ids and counts only — never customer names or the rationale prose (both are RM-facing UI,
 * not operational logs).
 */
@Service
public class ProspectFinder {

    private static final Logger log = LoggerFactory.getLogger(ProspectFinder.class);

    private final CustomerDirectory customers;
    private final PlanProposer proposer;
    private final DecisionLedger ledger;

    public ProspectFinder(CustomerDirectory customers, PlanProposer proposer, DecisionLedger ledger) {
        this.customers = customers;
        this.proposer = proposer;
        this.ledger = ledger;
    }

    /**
     * Build the worklist for an RM: every customer with a gate-passing suggested plan, fresh (un-served)
     * customers first, then alphabetical for a stable, deterministic order.
     *
     * <p>Customers for whom no scheme clears the gate are omitted — there is nothing suitable to propose, so
     * there is no row (an honest empty for that customer, mirroring the proposer's own "none" contract).
     *
     * @param rmId       the requesting RM's id, from the JWT (used only to form the ephemeral screening
     *                   proposals inside the proposer — nothing is persisted, so it never reaches a record)
     * @param branchCode the requesting RM's branch, from the JWT (same ephemeral use as {@code rmId})
     * @return the prospect rows, fresh-first (never null; empty if no customer has a passing plan)
     */
    public List<Prospect> findProspects(String rmId, String branchCode) {
        LocalDate today = LocalDate.now();
        Set<UUID> servedCustomerIds = ledger.findAll().stream()
                .map(record -> record.proposal().customerId())
                .collect(Collectors.toUnmodifiableSet());

        List<Prospect> prospects = new ArrayList<>();
        for (CustomerProfile customer : customers.findAll(today)) {
            proposer.propose(customer.customerId(), rmId, branchCode).ifPresent(plan ->
                    prospects.add(new Prospect(customer, plan, servedCustomerIds.contains(customer.customerId()))));
        }
        // Fresh (not-yet-served) rows first — those are the actionable ones — then a stable alphabetical
        // tie-break so the list order is fully deterministic across requests.
        prospects.sort(Comparator.comparing(Prospect::alreadyServed)
                .thenComparing(prospect -> prospect.customer().fullName()));

        long fresh = prospects.stream().filter(prospect -> !prospect.alreadyServed()).count();
        log.info("Prospect worklist for rm={}: {} rows ({} fresh, {} already served)",
                rmId, prospects.size(), fresh, prospects.size() - fresh);
        return prospects;
    }
}
