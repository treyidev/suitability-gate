package com.treyi.suitabilitygate.shared;

/**
 * Origin of a canonical record — the synthetic demo source now, IDBI's real systems later.
 *
 * <p>Stamped onto profiles, schemes, and every DecisionRecord's provenance so a reader can always
 * tell whether a decision was made against synthetic or production data ("synthetic now, IDBI later").
 */
public enum SourceSystem {
    SYNTHETIC,
    IDBI
}
