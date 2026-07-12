package com.treyi.suitabilitygate.gateway.security;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

/**
 * The three hardcoded demo identities (locked decision D9, extended for the customer transparency portal
 * 2026-07-12). Prototype-only: no user store, no signup.
 *
 * <p>Single source of truth for both credential checking (used to build the in-memory user store) and
 * token issuance (role + branch + optional customerId claims). Passwords are demo credentials, hardcoded
 * by design; the real secret — the JWT signing key — comes from the environment.
 *
 * <p><b>Two staff faces + one investor face:</b> {@code rm.demo} (RM) and {@code supervisor.demo}
 * (compliance) are staff — no {@code customerId}. {@code customer.demo} is an investor (Mrs. Sunita
 * Sharma), bound to her canonical {@code customerId} so the read-only transparency portal shows HER
 * profile and HER decisions and nobody else's — the bound id, not a request parameter, is the whole
 * access boundary for {@code /my/*}.
 *
 * <p>Production replaces this with the bank's SSO/IdP behind the same Spring Security seam.
 */
@Component
public class DemoIdentities {

    /** Relationship-manager role name (authority becomes {@code ROLE_RM}). */
    public static final String ROLE_RM = "RM";

    /** Compliance/supervisor role name (authority becomes {@code ROLE_COMPLIANCE}). */
    public static final String ROLE_COMPLIANCE = "COMPLIANCE";

    /** Investor role name (authority becomes {@code ROLE_CUSTOMER}) — the transparency-portal viewer. */
    public static final String ROLE_CUSTOMER = "CUSTOMER";

    /**
     * Mrs. Sunita Sharma's canonical customerId — the persona {@code customer.demo} represents. Kept as a
     * literal (not a reference to {@code customerdata.synthetic.SyntheticCustomerAdapter.SHARMA}) so the
     * gateway module does not reach into the customerdata module's internals and break the Modulith
     * boundary check; verified against that source, which is the authority for persona ids.
     */
    private static final UUID SHARMA_CUSTOMER_ID =
            UUID.fromString("c0000000-0000-0000-0000-000000000001");

    private final Map<String, DemoIdentity> byUsername;

    public DemoIdentities() {
        List<DemoIdentity> all = List.of(
                new DemoIdentity("rm.demo", "password", ROLE_RM, "PUNE-01", null),
                new DemoIdentity("supervisor.demo", "password", ROLE_COMPLIANCE, "HQ", null),
                // The investor face: bound to Sharma's canonical id so her portal shows only her own record.
                new DemoIdentity("customer.demo", "password", ROLE_CUSTOMER, "PUNE-01", SHARMA_CUSTOMER_ID));
        this.byUsername = all.stream()
                .collect(Collectors.toMap(DemoIdentity::username, Function.identity()));
    }

    /** All identities (used to build the in-memory user store). */
    public Collection<DemoIdentity> all() {
        return byUsername.values();
    }

    /** Look up an identity by username (for role/branch claims after successful authentication). */
    public Optional<DemoIdentity> find(String username) {
        return Optional.ofNullable(byUsername.get(username));
    }

    /**
     * One demo identity.
     *
     * @param username    login name
     * @param rawPassword demo password (hardcoded by design; encoded before storage)
     * @param role        role name ({@code RM} / {@code COMPLIANCE} / {@code CUSTOMER})
     * @param branchCode  the identity's home branch, carried into the audit record for evaluations
     * @param customerId  for an investor identity ({@code CUSTOMER}), the canonical customer this login
     *                    represents — issued as a JWT claim and used to scope the transparency portal to
     *                    that customer's own record; {@code null} for staff identities (RM / compliance)
     */
    public record DemoIdentity(String username, String rawPassword, String role, String branchCode,
            UUID customerId) {
    }
}
