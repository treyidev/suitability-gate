package com.treyi.suitabilitygate.suitability;

import java.util.Objects;

import com.treyi.suitabilitygate.customerdata.CustomerProfile;

/**
 * One row of the RM "Prospects" co-pilot worklist — a customer paired with a suitable, gate-passing plan
 * the RM could propose to them, plus whether that customer already has any decision on record.
 *
 * <p><b>Where it fits (the thesis, upheld):</b> this is an <em>advisory discovery row</em>, never a
 * decision. The {@code plan} is produced by the same deterministic {@link PlanProposer} the Evaluate-form
 * co-pilot uses — it only ever surfaces a product that already clears the suitability gate for this
 * customer. The RM picks a row, the Evaluate form is pre-filled, and the deterministic gate still
 * adjudicates the verdict on Submit with the supervisor's approval after. <em>AI proposes · human accepts ·
 * code decides · human approves</em> — the co-pilot never advises a customer directly and never renders a
 * verdict.
 *
 * <p><b>{@code alreadyServed}</b> is a UI signal only: true when the customer already has at least one
 * committed decision in the ledger (any verdict / any approval state), so the workbench can visually
 * distinguish an established client from a fresh prospect. It is derived server-side from the ledger — an
 * RM never reads the cross-RM ledger directly (that stays COMPLIANCE-only); only this boolean crosses the
 * wire, never another RM's records.
 *
 * @param customer      the customer this prospect row is for (canonical profile, as of today)
 * @param plan          a suitable plan that clears the gate for the customer (scheme + amount + type + rationale)
 * @param alreadyServed whether the customer already has ≥1 decision on record (a UI "already served" flag)
 */
public record Prospect(CustomerProfile customer, ProposedPlan plan, boolean alreadyServed) {

    public Prospect {
        Objects.requireNonNull(customer, "customer");
        Objects.requireNonNull(plan, "plan");
    }
}
