package com.treyi.suitabilitygate.gateway.security;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Validates the {@code Authorization: Bearer <jwt>} header and, if valid, populates the Spring Security
 * context with an {@link AuthPrincipal} and the caller's role authority.
 *
 * <p>Deliberately NOT a {@code @Component}: it is constructed by {@code SecurityConfig} and added inside
 * the security chain, so it isn't also auto-registered as a servlet filter outside it. On an invalid or
 * expired token it simply leaves the context unauthenticated — the entry point then returns 401 for
 * protected endpoints, keeping the failure path in one place.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(JwtAuthenticationFilter.class);
    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            authenticate(header.substring(BEARER_PREFIX.length()));
        }
        filterChain.doFilter(request, response);
    }

    private void authenticate(String token) {
        try {
            Claims claims = jwtService.parse(token).getPayload();
            String username = claims.getSubject();
            String role = claims.get(JwtService.roleClaim(), String.class);
            String branch = claims.get(JwtService.branchClaim(), String.class);
            // Present only on an investor token; parse back into the UUID the portal scopes on. Absent for
            // staff tokens, so the principal's customerId stays null and /my/* has nothing to resolve.
            String customerIdRaw = claims.get(JwtService.customerIdClaim(), String.class);
            UUID customerId = customerIdRaw == null ? null : UUID.fromString(customerIdRaw);

            AuthPrincipal principal = new AuthPrincipal(username, role, branch, customerId);
            var authorities = List.of(new SimpleGrantedAuthority("ROLE_" + role));
            var authentication = new UsernamePasswordAuthenticationToken(principal, null, authorities);
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (JwtException | IllegalArgumentException ex) {
            // Invalid/expired token: stay unauthenticated; the entry point returns 401 where required.
            log.warn("Rejected JWT: {}", ex.getMessage());
            SecurityContextHolder.clearContext();
        }
    }
}
