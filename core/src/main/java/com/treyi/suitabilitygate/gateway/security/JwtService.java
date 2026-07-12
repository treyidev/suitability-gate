package com.treyi.suitabilitygate.gateway.security;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.UUID;

import javax.crypto.SecretKey;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jws;
import io.jsonwebtoken.JwtBuilder;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;

/**
 * Mints and verifies the HMAC-signed JWTs (jjwt). Prototype: symmetric key from the environment,
 * short-lived tokens, no refresh (brief §12).
 *
 * <p>The signing key is the real secret and comes from {@code JWT_SECRET} (env). Production swaps this
 * for asymmetric keys / JWKS behind the same Spring Security seam — a config change, not a rewrite.
 */
@Service
public class JwtService {

    private static final String ROLE_CLAIM = "role";
    private static final String BRANCH_CLAIM = "branch";
    private static final String CUSTOMER_ID_CLAIM = "customerId";

    private final SecretKey signingKey;
    private final long ttlMinutes;

    public JwtService(
            @Value("${suitabilitygate.security.jwt.secret}") String secret,
            @Value("${suitabilitygate.security.jwt.ttl-minutes}") long ttlMinutes) {
        // HS256 requires a key of at least 256 bits; the configured secret must be >= 32 bytes.
        this.signingKey = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.ttlMinutes = ttlMinutes;
    }

    /**
     * Issue a signed token for an authenticated identity.
     *
     * <p>The {@code customerId} claim is issued only for an investor identity (the transparency portal);
     * for staff (RM / compliance) it is {@code null} and the claim is omitted entirely — a staff token
     * therefore never carries a customer scope, so {@code /my/*} cannot be reached with one even before
     * role gating. It is stored as the UUID's string form (JWT claims are JSON scalars).
     *
     * @param username   the subject
     * @param role       role name (unprefixed, e.g. {@code RM})
     * @param branchCode the identity's branch, carried as a claim
     * @param customerId the investor this identity represents, or {@code null} for a staff identity
     * @return the compact JWT string
     */
    public String issue(String username, String role, String branchCode, @Nullable UUID customerId) {
        Instant now = Instant.now();
        JwtBuilder builder = Jwts.builder()
                .subject(username)
                .claim(ROLE_CLAIM, role)
                .claim(BRANCH_CLAIM, branchCode)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(ttlMinutes, ChronoUnit.MINUTES)))
                .signWith(signingKey);
        if (customerId != null) {
            builder.claim(CUSTOMER_ID_CLAIM, customerId.toString());
        }
        return builder.compact();
    }

    /**
     * Verify a token's signature and expiry and return its claims.
     *
     * @param token the compact JWT string
     * @return the verified claims
     * @throws io.jsonwebtoken.JwtException if the token is malformed, mis-signed, or expired
     */
    public Jws<Claims> parse(String token) {
        return Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(token);
    }

    /** Claim key for the role. */
    public static String roleClaim() {
        return ROLE_CLAIM;
    }

    /** Claim key for the branch. */
    public static String branchClaim() {
        return BRANCH_CLAIM;
    }

    /** Claim key for the customer id (present only on an investor/transparency-portal token). */
    public static String customerIdClaim() {
        return CUSTOMER_ID_CLAIM;
    }
}
