/**
 * Display formatting helpers + display-label constants shared across screens. Pure functions and
 * constants, no state — kept in one module so currency/label rendering is identical everywhere (a
 * rupee amount always looks the same; a transaction type always reads "SIP", never "Sip").
 *
 * This is the single source of truth for display-label EXCEPTIONS: the {@link TRANSACTION_TYPE_LABELS}
 * map (exhaustive over the {@link TransactionType} union, so a future Phase-2 type fails the build
 * until labelled) and the {@link ABBREVIATIONS} initialism set consumed by {@link humanizeLabel}.
 */
import type { TransactionType } from "./api/types";

/**
 * Explicit display label per transaction type — the single source of truth (owner-directed
 * 2026-07-11). `Record<TransactionType, string>` enforces exhaustiveness: adding a Phase-2 transaction
 * type to the union fails the build here until it is given a label. Every render of a transaction type
 * (currently the segmented control) reads from this map — never a string literal at the call site.
 */
export const TRANSACTION_TYPE_LABELS: Record<TransactionType, string> = {
  LUMPSUM: "Lumpsum",
  SIP: "SIP",
} as const;

/** Indian-grouping rupee formatter (₹1,00,000), reused rather than re-created per call. */
const RUPEE_FORMAT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/**
 * Format an INR amount with Indian digit grouping and the ₹ symbol.
 *
 * @param amount rupee amount, or null when the source system supplied none
 * @returns e.g. `₹1,00,000`, or `—` for null
 */
export function formatInr(amount: number | null): string {
  return amount === null ? "—" : RUPEE_FORMAT.format(amount);
}

/**
 * Turn an UPPER_SNAKE enum token into Title Case for display (`EQUITY_SMALL_CAP` → `Equity Small Cap`,
 * `VERY_HIGH` → `Very High`). Backend categoricals arrive in this form.
 *
 * Use for tokens that are plain words (e.g. rule ids like `AGE_RISK_BAND`). For user-facing
 * categoricals that may contain initialisms (transaction type, scheme category), prefer
 * {@link humanizeLabel}, which keeps abbreviations upper-cased (`SIP`, not `Sip`).
 *
 * @param token enum token; empty/undefined yields an empty string
 * @returns human-readable label
 */
export function humanizeToken(token: string): string {
  return token
    .toLowerCase()
    .split("_")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(" ");
}

/** Initialisms that must stay fully upper-cased when a token is humanised for display. */
const ABBREVIATIONS = new Set(["SIP", "KYC", "ELSS", "NAV", "INR", "RM", "IDBI", "SEBI", "AMC"]);

/**
 * Human-readable label for an UPPER_SNAKE token that MAY contain an initialism — like
 * {@link humanizeToken}, but a word in {@link ABBREVIATIONS} stays upper-cased: `SIP` → `SIP` (not
 * `Sip`), `EQUITY_ELSS` → `Equity ELSS`. Fixes the transaction-type label and any abbreviation-bearing
 * categorical; rule ids (no initialisms) keep {@link humanizeToken}.
 *
 * @param token enum token; empty/undefined yields an empty string
 * @returns human-readable label with known initialisms preserved
 */
export function humanizeLabel(token: string): string {
  return token
    .toUpperCase()
    .split("_")
    .map((word) => {
      if (!word) return word;
      return ABBREVIATIONS.has(word) ? word : word[0] + word.slice(1).toLowerCase();
    })
    .join(" ");
}

/** Short day-month + 24h time formatter (`11 Jul, 17:40`) for the compliance ledger table. */
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/**
 * Format an ISO-8601 timestamp as a compact local day + 24h time (`2026-07-11T12:10:55Z` → `11 Jul, 17:40`)
 * for the compliance records table. Localised to the viewer's timezone by {@link Intl.DateTimeFormat}.
 *
 * @param iso an ISO-8601 timestamp string (e.g. {@code DecisionRecord.createdAt})
 * @returns a short human date-time, or `—` if the string is not a valid date
 */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : DATE_TIME_FORMAT.format(date);
}

/** Short date-only formatter (`06 Jan 2025`) — day-month-year with no time of day. */
const DATE_FORMAT = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/**
 * Format an ISO date as a compact day-month-year with NO time of day (`2025-01-06` → `06 Jan 2025`).
 *
 * Use for date-only fields — a risk-profile date, a KYC date — where the midnight time that
 * {@link formatDateTime} would append is meaningless noise (and, parsed as UTC then shown in a +offset
 * timezone, actively misleading). For real timestamps (a decision's creation time) use
 * {@link formatDateTime}.
 *
 * @param iso an ISO-8601 date (or date-time) string
 * @returns a short date, or `—` if the string is not a valid date
 */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : DATE_FORMAT.format(date);
}

/**
 * Render a month count as a short duration (`0` → `None`, `120` → `10 yr`, `20` → `20 mo`).
 *
 * @param months a non-negative month count
 * @returns compact human label
 */
export function formatMonths(months: number): string {
  if (months === 0) {
    return "None";
  }
  if (months % 12 === 0) {
    return `${months / 12} yr`;
  }
  return `${months} mo`;
}
