package com.treyi.suitabilitygate.gateway;

import java.io.IOException;
import java.util.UUID;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Puts a per-request correlation id into MDC so every log line for one evaluation shares an id
 * (CLAUDE.md §5). Runs first, echoes the id as a response header for support, and always clears MDC.
 *
 * <p>This is the operational-traceability seam: the {@code evalId} it sets is what the console pattern
 * renders as {@code [%X{evalId}]}. If the request carries an inbound {@value #EVAL_ID_HEADER}, it is
 * honoured (lets a caller propagate a trace); otherwise a fresh short id is minted.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class CorrelationIdFilter extends OncePerRequestFilter {

    /** MDC key; must match the {@code %X{evalId}} token in logback-spring.xml. */
    public static final String EVAL_ID_KEY = "evalId";

    /** Response (and optional inbound) header carrying the correlation id. */
    public static final String EVAL_ID_HEADER = "X-Eval-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String evalId = resolveId(request);
        MDC.put(EVAL_ID_KEY, evalId);
        response.setHeader(EVAL_ID_HEADER, evalId);
        try {
            filterChain.doFilter(request, response);
        } finally {
            MDC.remove(EVAL_ID_KEY);
        }
    }

    private String resolveId(HttpServletRequest request) {
        String inbound = request.getHeader(EVAL_ID_HEADER);
        if (inbound != null && !inbound.isBlank()) {
            return inbound;
        }
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
