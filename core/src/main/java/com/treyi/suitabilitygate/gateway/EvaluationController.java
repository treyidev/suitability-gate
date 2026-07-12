package com.treyi.suitabilitygate.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.treyi.suitabilitygate.gateway.security.AuthPrincipal;
import com.treyi.suitabilitygate.suitability.DecisionRecord;
import com.treyi.suitabilitygate.suitability.EvaluationOutcome;
import com.treyi.suitabilitygate.suitability.EvaluationPipeline;
import com.treyi.suitabilitygate.suitability.ProposedTransaction;

/**
 * HTTP entry point for suitability evaluations — the RM's {@code POST /evaluations} (role-gated to
 * {@code ROLE_RM} by Spring Security).
 *
 * <p>The gateway is a thin BFF (brief §3.1): it delegates straight to the {@link EvaluationPipeline} and
 * returns the frozen {@link DecisionRecord}. The {@code rmId} and {@code branchCode} come from the
 * authenticated {@link AuthPrincipal} (the token), not the request body — so the audit record's identity
 * is the one that logged in.
 */
@RestController
public class EvaluationController {

    private static final Logger log = LoggerFactory.getLogger(EvaluationController.class);

    private final EvaluationPipeline pipeline;

    public EvaluationController(EvaluationPipeline pipeline) {
        this.pipeline = pipeline;
    }

    /**
     * Evaluate a proposed transaction and return the frozen decision record.
     *
     * @param request the customer/scheme/amount/type (identity comes from the token, not here)
     * @param rm      the authenticated relationship manager, from the JWT
     * @return the full decision record
     */
    @PostMapping("/evaluations")
    @PreAuthorize("hasRole('RM')")
    public DecisionRecord evaluate(@RequestBody EvaluationRequest request,
            @AuthenticationPrincipal AuthPrincipal rm) {
        ProposedTransaction proposal = new ProposedTransaction(request.customerId(), request.schemeId(),
                request.amountInr(), request.transactionType(), rm.username(), rm.branchCode());
        log.debug("Evaluation request by rm={} branch={}: customer={} scheme={} amount={}",
                rm.username(), rm.branchCode(), request.customerId(), request.schemeId(), request.amountInr());
        return pipeline.evaluate(proposal);
    }

    /**
     * Preview a proposed transaction's verdict WITHOUT recording it — the RM's pre-submit check.
     *
     * <p>Runs the same deterministic rules as {@link #evaluate} via {@link EvaluationPipeline#screen}, but
     * persists nothing: no certificate, no ledger write, no explanation event. The RM reviews the outcome
     * and then commits it via {@code POST /evaluations} (Submit). Determinism guarantees this preview
     * equals the record that Submit will freeze — so nothing is lost by checking first.
     *
     * @param request the customer/scheme/amount/type to preview (identity comes from the token)
     * @param rm      the authenticated relationship manager, from the JWT
     * @return the non-persisted verdict preview
     */
    @PostMapping("/evaluations/preview")
    @PreAuthorize("hasRole('RM')")
    public EvaluationPreview preview(@RequestBody EvaluationRequest request,
            @AuthenticationPrincipal AuthPrincipal rm) {
        ProposedTransaction proposal = new ProposedTransaction(request.customerId(), request.schemeId(),
                request.amountInr(), request.transactionType(), rm.username(), rm.branchCode());
        log.debug("Preview request by rm={} branch={}: customer={} scheme={}",
                rm.username(), rm.branchCode(), request.customerId(), request.schemeId());
        EvaluationOutcome outcome = pipeline.screen(proposal);
        return EvaluationPreview.from(outcome);
    }
}
