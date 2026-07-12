package com.treyi.suitabilitygate.gateway;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import com.treyi.suitabilitygate.suitability.EvaluationException;
import com.treyi.suitabilitygate.suitability.OverrideConflictException;
import com.treyi.suitabilitygate.suitability.ResourceNotFoundException;

/**
 * Translates failures into RFC-7807 {@code application/problem+json} responses (brief §7).
 *
 * <p>Maps the domain exception hierarchy to sensible statuses ({@link ResourceNotFoundException} → 404,
 * other {@link EvaluationException} / malformed body → 400) and everything else to 500. 4xx log at WARN
 * (client-caused), 5xx at ERROR (our fault) — with the correlation id already in MDC.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    public ProblemDetail handleNotFound(ResourceNotFoundException ex) {
        log.warn("404 Not Found: {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, ex.getMessage());
        problem.setTitle("Resource not found");
        return problem;
    }

    @ExceptionHandler(OverrideConflictException.class)
    public ProblemDetail handleOverrideConflict(OverrideConflictException ex) {
        // A FLAGGED decision has already been reviewed (Phase-1 one-review-per-record policy).
        log.warn("409 Conflict: {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.CONFLICT, ex.getMessage());
        problem.setTitle("Decision already reviewed");
        return problem;
    }

    @ExceptionHandler(AuthenticationException.class)
    public ProblemDetail handleAuthentication(AuthenticationException ex) {
        // Bad credentials at /auth/login (failures inside the security filter chain use ProblemSecurityHandler).
        log.warn("401 Unauthorized (login): {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.UNAUTHORIZED,
                "Invalid username or password.");
        problem.setTitle("Authentication failed");
        return problem;
    }

    @ExceptionHandler(EvaluationException.class)
    public ProblemDetail handleEvaluation(EvaluationException ex) {
        log.warn("400 Bad Request (evaluation): {}", ex.getMessage());
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, ex.getMessage());
        problem.setTitle("Invalid evaluation request");
        return problem;
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ProblemDetail handleUnreadable(HttpMessageNotReadableException ex) {
        // Record compact-constructor validation (nulls, non-positive amount) surfaces here on bad input.
        String detail = ex.getMostSpecificCause().getMessage();
        log.warn("400 Bad Request (unreadable body): {}", detail);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST,
                "Malformed or invalid request body: " + detail);
        problem.setTitle("Invalid request body");
        return problem;
    }

    @ExceptionHandler(Exception.class)
    public ProblemDetail handleUnexpected(Exception ex) {
        log.error("500 Internal Server Error", ex);
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(HttpStatus.INTERNAL_SERVER_ERROR,
                "An unexpected error occurred.");
        problem.setTitle("Internal server error");
        return problem;
    }
}
