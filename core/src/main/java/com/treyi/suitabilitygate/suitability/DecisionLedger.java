package com.treyi.suitabilitygate.suitability;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * The ledger port — how the pipeline persists and reads decisions, without depending on any storage.
 *
 * <p><b>Dependency Inversion (the acyclic seam):</b> this interface lives in {@code suitability} (the
 * pipeline needs it); {@code decisionrecord} <em>implements</em> it and owns the actual store. So the
 * dependency points {@code decisionrecord → suitability}, never the reverse — no Modulith cycle — and
 * swapping the store (in-memory → H2/JPA → Postgres) is one adapter behind this port, pipeline untouched.
 *
 * <p><b>Append-only by contract:</b> there is no update or delete. {@link #record} assigns the record's
 * identity (id, certificate number, timestamp) and appends it; history only grows.
 */
public interface DecisionLedger {

    /**
     * Freeze a draft into an immutable {@link DecisionRecord} — assigning its id, certificate number,
     * and creation time — and append it to the ledger.
     *
     * @param draft everything computed by the pipeline except the ledger-assigned identity
     * @return the frozen, stored record
     */
    DecisionRecord record(DecisionDraft draft);

    /**
     * Read a single decision by id.
     *
     * <p>If an explanation has since been attached (see {@link #attachExplanation}), the returned
     * record carries it in {@code aiContribution} — the overlay happens on read; the frozen decision
     * itself is never rewritten.
     *
     * @param recordId the record id
     * @return the record, or empty if none
     */
    Optional<DecisionRecord> findById(UUID recordId);

    /**
     * Read the whole ledger, newest decision first — the compliance-wide view that backs the supervisor
     * dashboard (access-gated to ROLE_COMPLIANCE at the endpoint, since it crosses every RM's records).
     *
     * <p><b>No explanation overlay (deliberate):</b> unlike {@link #findById}, this does <em>not</em> attach
     * the async explanation prose. The dashboard aggregates and tabulates verdicts/rules/metadata, none of
     * which need the narrative; skipping the overlay avoids an N+1 explanation lookup across the full ledger.
     * A drill-down into a single record still goes through {@link #findById}, which does overlay it.
     *
     * @return every persisted decision, ordered by creation time descending (may be empty, never null)
     */
    List<DecisionRecord> findAll();

    /**
     * Read one customer's own decisions, newest first — the read that backs the customer transparency
     * portal ({@code GET /my/records}, access-gated to that customer by their token's {@code customerId}).
     *
     * <p><b>Explanation overlay INCLUDED (the deliberate contrast with {@link #findAll}):</b> unlike the
     * whole-ledger dashboard read, this DOES attach the async explanation prose to every returned record.
     * Two reasons make that the right call here where it is wrong there: (1) the customer-facing prose IS
     * the point — it is the plain-language "why" the investor is entitled to see, not incidental metadata;
     * (2) one customer's slice is small (a handful of decisions), so the per-record explanation lookup is a
     * bounded cost, not the N+1-across-the-whole-ledger the dashboard deliberately avoids. Supervisor
     * reviews are overlaid too, so the portal can show each decision's Pending/Approved/Rejected state.
     *
     * @param customerId the customer whose decisions to return (from the caller's verified token, never a
     *                   request parameter)
     * @return that customer's decisions, newest first, each with explanation + review overlays stitched
     *         (never null; empty if the customer has no decisions)
     */
    List<DecisionRecord> findByCustomerId(UUID customerId);

    /**
     * Attach the asynchronously rendered explanation to a decision.
     *
     * <p><b>Append-only preserved:</b> this does NOT update the frozen decision row — the explanation
     * is stored alongside it (insert-once) and overlaid into {@code aiContribution} on read. Calling
     * again for the same record is a no-op (first attach wins), so a redelivered event cannot rewrite
     * history.
     *
     * @param recordId        the decision to attach to
     * @param provider        which generation path produced the text (e.g. {@code stub-canned-v1})
     * @param explanationText the rendered prose
     */
    void attachExplanation(UUID recordId, String provider, String explanationText);

    /**
     * Record that the async explanation could not be rendered (provider unreachable/errored). The
     * decision stands; only the prose is absent. Insert-once like {@link #attachExplanation}.
     *
     * @param recordId the decision whose explanation failed
     */
    void markExplanationFailed(UUID recordId);

    /**
     * Record a supervisor's mandatory human decision on a decision record — a separate appended event
     * (brief §6.1, D11), never a mutation of the frozen record. Humans are always in the loop: any decision
     * (PASS or FLAGGED) may be approved or rejected before it is final. The reviewer's identity comes from
     * the caller's token, not the body; the stored event is stitched into the record's {@code overrides} on read.
     *
     * <p><b>Rules enforced here (the write boundary):</b> the record must exist (else
     * {@link ResourceNotFoundException} → 404); Phase-1 policy is one decision per record — a second attempt
     * throws {@link OverrideConflictException} → 409 (append-only history is never re-litigated).
     *
     * @param recordId        the decision to approve or reject
     * @param resultingStatus the human outcome ({@link OverrideStatus#APPROVED} or {@link OverrideStatus#REJECTED})
     * @param justification   the supervisor's mandatory, non-blank rationale
     * @param overriddenBy    the supervisor's identity, from the verified JWT
     * @return the recorded {@link OverrideEvent}
     */
    OverrideEvent attachOverride(UUID recordId, OverrideStatus resultingStatus, String justification,
            String overriddenBy);
}
