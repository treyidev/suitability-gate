package com.treyi.suitabilitygate.gateway;

import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.treyi.suitabilitygate.gateway.security.DemoIdentities;
import com.treyi.suitabilitygate.gateway.security.DemoIdentities.DemoIdentity;
import com.treyi.suitabilitygate.gateway.security.JwtService;

/**
 * Authentication endpoint — {@code POST /auth/login}. Validates credentials via Spring Security's
 * {@link AuthenticationManager} (against the in-memory demo users), then issues a signed JWT carrying the
 * role and branch claims.
 */
@RestController
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final DemoIdentities identities;

    public AuthController(AuthenticationManager authenticationManager, JwtService jwtService,
            DemoIdentities identities) {
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.identities = identities;
    }

    /**
     * Authenticate and mint a token.
     *
     * @param request username + password
     * @return the token and the caller's role authority (e.g. {@code ROLE_RM})
     */
    @PostMapping("/auth/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        // Throws AuthenticationException on bad credentials → mapped to 401 by GlobalExceptionHandler.
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));

        DemoIdentity identity = identities.find(request.username())
                .orElseThrow(() -> new IllegalStateException(
                        "Authenticated user missing from identities: " + request.username()));
        // customerId is issued as a claim only for an investor identity (null for staff) — the transparency
        // portal's scope travels in the signed token, never in a request parameter.
        String token = jwtService.issue(identity.username(), identity.role(), identity.branchCode(),
                identity.customerId());
        return new LoginResponse(token, "ROLE_" + identity.role());
    }

    /** Login credentials. */
    public record LoginRequest(String username, String password) {
    }

    /** Issued token plus the caller's role authority. */
    public record LoginResponse(String token, String role) {
    }
}
