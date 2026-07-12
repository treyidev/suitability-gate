package com.treyi.suitabilitygate.gateway.security;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

/**
 * Renders Spring Security failures as RFC-7807 {@code application/problem+json}, consistent with the
 * rest of the API. Security failures happen inside the filter chain (before {@code @RestControllerAdvice}
 * runs), so they need their own handlers.
 *
 * <ul>
 *   <li>Unauthenticated request to a protected endpoint → 401 (via {@link AuthenticationEntryPoint}).</li>
 *   <li>Authenticated but wrong role → 403 (via {@link AccessDeniedHandler}) — e.g. an RM-only endpoint
 *       hit by a compliance token.</li>
 * </ul>
 */
@Component
public class ProblemSecurityHandler implements AuthenticationEntryPoint, AccessDeniedHandler {

    private static final Logger log = LoggerFactory.getLogger(ProblemSecurityHandler.class);

    private final ObjectMapper objectMapper;

    public ProblemSecurityHandler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
            AuthenticationException authException) throws IOException {
        log.warn("401 Unauthorized: {} {}", request.getMethod(), request.getRequestURI());
        writeProblem(response, HttpStatus.UNAUTHORIZED, "Authentication required",
                "A valid bearer token is required to access this resource.");
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
            AccessDeniedException accessDeniedException) throws IOException {
        log.warn("403 Forbidden: {} {}", request.getMethod(), request.getRequestURI());
        writeProblem(response, HttpStatus.FORBIDDEN, "Insufficient role",
                "Your role is not permitted to perform this action.");
    }

    private void writeProblem(HttpServletResponse response, HttpStatus status, String title,
            String detail) throws IOException {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(title);
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        objectMapper.writeValue(response.getWriter(), problem);
    }
}
