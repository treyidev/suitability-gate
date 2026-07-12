/**
 * A small labelled attribute pill — a tiny uppercase label over a value, in an optional amber "warn" tint.
 *
 * WHY THIS EXISTS (shared, extracted 2026-07-12): the RM workbench's customer/scheme context rows and the
 * customer transparency portal's "what the bank knows about me" grid render the same pill. Extracting it
 * (rather than duplicating) keeps one source of truth for the shape/tint semantics, so the two faces of the
 * same customer data always look identical and cannot drift. It is a pure presentational component — no
 * state, no lifecycle — so the extraction is clean (house reuse-first discipline).
 *
 * TINT SEMANTICS: `warn` tints the chip amber for attributes that FORESHADOW a warning (senior citizen, a
 * VERY_HIGH/HIGH riskometer) — these are not failures, so per the colour re-architecture (2026-07-11) they
 * use the amber warning family, never red or orange.
 *
 * WHERE IT FITS: presentation layer; consumed by {@link ../screens/RmWorkbench} (CustomerContext /
 * SchemeContext) and {@link ../screens/CustomerDashboard} (the profile grid).
 */

/** Props for {@link AttributeChip}. */
interface AttributeChipProps {
  /** Short uppercase label, e.g. `Age`, `KYC`, `Income`. */
  readonly label: string;
  /** The formatted value to show under the label. */
  readonly value: string;
  /** When true, tints the chip amber to foreshadow a likely warning (not a failure). */
  readonly warn?: boolean;
}

/** A small labelled attribute pill; amber-tinted when {@link AttributeChipProps.warn} foreshadows a warning. */
export function AttributeChip({ label, value, warn }: AttributeChipProps) {
  return (
    <div
      className={`rounded-md border px-2.5 py-1.5 ${
        warn ? "border-warning/30 bg-warning/15" : "border-line bg-surface-2"
      }`}
    >
      <div className="text-[10px] font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className={`text-[13px] font-medium ${warn ? "text-warning" : "text-ink"}`}>{value}</div>
    </div>
  );
}
