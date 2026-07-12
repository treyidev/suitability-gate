package com.treyi.suitabilitygate.gateway;

import com.treyi.suitabilitygate.suitability.ProposedPlan;

/**
 * Wire response for {@code POST /suggestions} — either a suggested plan, or an honest "none available".
 *
 * <p><b>Why a wrapper (not a bare plan or a 204):</b> "no scheme clears the gate for this client" is a
 * normal, meaningful outcome the RM must see, not an error. A 204 would leave the JSON client with no
 * body to parse; an explicit {@code available} flag lets the frontend branch cleanly between "here is a
 * suggestion" and "build a proposal manually — nothing passes".
 *
 * @param available whether a suitable plan was found
 * @param plan      the suggested plan when {@code available}, else null
 */
public record PlanSuggestionResponse(boolean available, ProposedPlan plan) {

    /** A found suggestion. */
    static PlanSuggestionResponse of(ProposedPlan plan) {
        return new PlanSuggestionResponse(true, plan);
    }

    /** No scheme in the catalogue clears the gate for this customer. */
    static PlanSuggestionResponse none() {
        return new PlanSuggestionResponse(false, null);
    }
}
