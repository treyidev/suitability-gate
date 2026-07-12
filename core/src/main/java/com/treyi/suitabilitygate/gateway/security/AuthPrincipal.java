package com.treyi.suitabilitygate.gateway.security;

import java.util.UUID;

import org.springframework.lang.Nullable;

/**
 * The authenticated caller derived from a verified JWT — the {@code SecurityContext} principal.
 *
 * <p>Carries the identity that flows into the audit record: {@code username} becomes the {@code rmId}
 * and {@code branchCode} the transaction branch on an evaluation, so who-did-what is recorded from the
 * token, not trusted from the request body.
 *
 * <p>{@code customerId} is the same token-derived-identity discipline for the transparency portal: it is
 * present only on an investor token and is the ONLY thing the {@code /my/*} endpoints scope on — the
 * customer whose profile and decisions are shown is the one in the verified token, never a request
 * parameter. It is {@code null} for staff (RM / compliance) identities.
 *
 * @param username   the authenticated user's login name
 * @param role       role name (unprefixed, e.g. {@code RM})
 * @param branchCode the user's branch
 * @param customerId the investor this session represents (transparency portal), or {@code null} for staff
 */
public record AuthPrincipal(String username, String role, String branchCode, @Nullable UUID customerId) {
}
