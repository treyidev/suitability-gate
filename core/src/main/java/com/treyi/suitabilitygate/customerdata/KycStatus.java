package com.treyi.suitabilitygate.customerdata;

/**
 * KYC verification state of a customer. Owned by Customer Data (not the shared kernel) because it is a
 * customer attribute, consumed only through {@link CustomerProfile}.
 *
 * <ul>
 *   <li>{@code VERIFIED} — KYC current and confirmed.</li>
 *   <li>{@code STALE} — previously verified but past its freshness window.</li>
 *   <li>{@code PENDING} — never completed.</li>
 * </ul>
 */
public enum KycStatus {
    VERIFIED,
    STALE,
    PENDING
}
