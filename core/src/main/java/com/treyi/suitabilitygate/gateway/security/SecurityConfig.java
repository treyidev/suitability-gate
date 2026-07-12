package com.treyi.suitabilitygate.gateway.security;

import java.util.List;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import com.treyi.suitabilitygate.gateway.CorrelationIdFilter;

/**
 * Spring Security configuration — stateless JWT, two role-gated endpoints (brief §12).
 *
 * <p><b>Why the framework (not a hand-rolled filter):</b> it gives a battle-tested filter chain,
 * declarative authorization, and a security context that carries the caller into the audit record — and,
 * long term, every production hardening (bank SSO/IdP, JWKS/asymmetric keys, mTLS, access-audit,
 * method security) becomes a config change behind this seam rather than a rewrite.
 *
 * <p>Phase-1 rules: {@code POST /auth/login} is public; {@code POST /evaluations} requires {@code ROLE_RM};
 * the staff read endpoints require an RM/compliance role; the customer transparency portal ({@code
 * GET /my/*}) requires {@code ROLE_CUSTOMER}; everything else requires authentication. No sessions, no CSRF
 * (token-based API); CORS is opened only to the configured frontend origin (see
 * {@link #corsConfigurationSource}). The JWT filter runs before the username/password filter and is
 * constructed here (not a bean) so it lives only in this chain.
 *
 * <p>Authorization is enforced at two layers (defense in depth): the URL rules below AND method-level
 * {@code @PreAuthorize} on the controllers ({@link EnableMethodSecurity}), so the access intent is also
 * visible at the point of use. The full endpoint × role matrix is documented in {@code CLAUDE.md}
 * "Security &amp; Access Control".
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * CORS policy for the browser frontend. The React app runs on its own origin (the Vite dev server),
     * distinct from this gateway even under docker compose, so the browser blocks its cross-origin calls
     * unless the gateway opts that origin in here.
     *
     * <p>Deliberately narrow: only the configured frontend origin, only the methods/headers the API
     * actually uses, and <b>no credentials</b> — this is a Bearer-token API with no cookies, so
     * {@code allowCredentials} stays false (which also keeps us off the insecure wildcard-with-credentials
     * path). The {@value CorrelationIdFilter#EVAL_ID_HEADER} response header is exposed so the frontend can
     * read the per-request correlation id for support/debugging.
     *
     * @param allowedOrigin the frontend origin, from {@code suitabilitygate.security.cors.allowed-origin}
     * @return the CORS source consulted by Spring Security's CORS filter
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${suitabilitygate.security.cors.allowed-origin}") String allowedOrigin) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(List.of(allowedOrigin));
        config.setAllowedMethods(List.of("GET", "POST"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setExposedHeaders(List.of(CorrelationIdFilter.EVAL_ID_HEADER));
        config.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    UserDetailsService userDetailsService(DemoIdentities identities, PasswordEncoder passwordEncoder) {
        List<UserDetails> users = identities.all().stream()
                .map(identity -> User.withUsername(identity.username())
                        .password(passwordEncoder.encode(identity.rawPassword()))
                        .roles(identity.role())
                        .build())
                .map(UserDetails.class::cast)
                .toList();
        return new InMemoryUserDetailsManager(users);
    }

    @Bean
    AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, JwtService jwtService,
            ProblemSecurityHandler problemSecurityHandler) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, "/auth/login").permitAll()
                        .requestMatchers(HttpMethod.POST, "/evaluations").hasRole(DemoIdentities.ROLE_RM)
                        // RM co-pilot: preview (non-persisted verdict check) and plan suggestion are the
                        // RM's own pre-submit tools — RM-only (a supervisor gets 403). Distinct exact paths
                        // (preview is NOT matched by "/evaluations" above, which is exact); gated here AND by
                        // @PreAuthorize on EvaluationController / SuggestionController.
                        .requestMatchers(HttpMethod.POST, "/evaluations/preview").hasRole(DemoIdentities.ROLE_RM)
                        .requestMatchers(HttpMethod.POST, "/suggestions").hasRole(DemoIdentities.ROLE_RM)
                        // Supervisor review of a FLAGGED decision is COMPLIANCE-only (the brief's demo
                        // moment: an RM attempting it gets 403). Distinct path from POST /evaluations, so
                        // order-independent; gated here AND by @PreAuthorize on OverrideController.
                        .requestMatchers(HttpMethod.POST, "/evaluations/*/override")
                        .hasRole(DemoIdentities.ROLE_COMPLIANCE)
                        // The whole-ledger list is COMPLIANCE-only. This exact-path rule MUST precede the
                        // "/records/**" rule below: "/**" also matches "/records" (zero trailing segments),
                        // so first-match-wins would otherwise let an RM through to the cross-RM list.
                        .requestMatchers(HttpMethod.GET, "/records").hasRole(DemoIdentities.ROLE_COMPLIANCE)
                        .requestMatchers(HttpMethod.GET, "/records/**", "/customers", "/schemes")
                        .hasAnyRole(DemoIdentities.ROLE_RM, DemoIdentities.ROLE_COMPLIANCE)
                        // RM Prospects co-pilot — the RM-only advisory worklist (customers + a gate-passing
                        // suggested plan + an "already served" flag). RM-only (a supervisor gets 403); the
                        // response is derived rows, never raw cross-RM records, so it never widens ledger
                        // visibility. Gated here AND by @PreAuthorize on ProspectController.
                        .requestMatchers(HttpMethod.GET, "/prospects").hasRole(DemoIdentities.ROLE_RM)
                        // Customer transparency portal — CUSTOMER-only. An investor sees ONLY their own
                        // profile and their own decisions; the scope is the token's customerId, resolved in
                        // the controller (never a path/param). Gated in depth: these URL rules AND
                        // @PreAuthorize on CustomerPortalController. Deliberately NOT hasAnyRole with the
                        // staff roles — a customer must not reach /records*, /customers, /schemes, or
                        // /evaluations* (those stay RM/COMPLIANCE above), and staff have no /my/* scope
                        // (their tokens carry no customerId), so this is a clean, disjoint third face.
                        .requestMatchers(HttpMethod.GET, "/my/profile", "/my/records")
                        .hasRole(DemoIdentities.ROLE_CUSTOMER)
                        .anyRequest().authenticated())
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(problemSecurityHandler)
                        .accessDeniedHandler(problemSecurityHandler))
                .addFilterBefore(new JwtAuthenticationFilter(jwtService),
                        UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
