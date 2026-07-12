/**
 * The app's small inline icon set — hand-kept SVGs instead of an icon-library dependency.
 *
 * Why inline: the UI needs six glyphs; an icon package would add a dependency (and its supply-chain
 * surface) for no gain. All icons are 24×24 viewBox, stroke-based, and inherit `currentColor`, so
 * they tint via the surrounding text colour utility. Size with the `className` prop (`h-4 w-4` etc.).
 *
 * SAFE EXTENSION: add further glyphs here as components. REGRESSION TO AVOID: importing an icon
 * library alongside these — pick one approach, don't mix.
 */
import type { ReactNode } from "react";

/** Common props for every icon. */
interface IconProps {
  /** Tailwind sizing/colour classes, e.g. `h-4 w-4 text-muted`. */
  readonly className?: string;
}

/** Shared SVG shell so every icon carries identical stroke conventions. */
function Icon({ className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Person silhouette — username field. */
export function UserIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19.5c1.2-3.2 3.9-4.8 7-4.8s5.8 1.6 7 4.8" />
    </Icon>
  );
}

/** Padlock — password field and security cues. */
export function LockIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="5.5" y="10.5" width="13" height="9" rx="2" />
      <path d="M8.5 10.5V7.75a3.5 3.5 0 0 1 7 0v2.75" />
    </Icon>
  );
}

/** Open eye — "show password". */
export function EyeIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M2.5 12S6 5.75 12 5.75 21.5 12 21.5 12 18 18.25 12 18.25 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </Icon>
  );
}

/** Struck-through eye — "hide password". */
export function EyeOffIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 4l16 16" />
      <path d="M9.9 5.1A9.6 9.6 0 0 1 12 5.75C18 5.75 21.5 12 21.5 12a17.3 17.3 0 0 1-2.7 3.4M6.3 6.9C4 8.8 2.5 12 2.5 12S6 18.25 12 18.25a8.8 8.8 0 0 0 3.4-.66" />
      <path d="M9.6 9.9a2.75 2.75 0 0 0 3.87 3.87" />
    </Icon>
  );
}

/** Check inside a circle — feature/proof rows. */
export function CheckCircleIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </Icon>
  );
}

/** Right arrow — primary action affordance. */
export function ArrowRightIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4.5 12h15" />
      <path d="m13.5 6 6 6-6 6" />
    </Icon>
  );
}

/** Chevron down — select/disclosure affordance. */
export function ChevronDownIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m6 9.5 6 6 6-6" />
    </Icon>
  );
}

/** Shield with a check — the PASS verdict. */
export function ShieldCheckIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 3.5 5 6.2v5c0 4.2 2.9 7.3 7 8.8 4.1-1.5 7-4.6 7-8.8v-5L12 3.5Z" />
      <path d="m9 11.5 2.2 2.2L15 9.8" />
    </Icon>
  );
}

/** Pennant flag — the FLAGGED verdict. */
export function FlagIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6 21V4" />
      <path d="M6 4.5h10.5l-2 3.5 2 3.5H6" />
    </Icon>
  );
}

/** X in a circle — a rule FAIL. */
export function XCircleIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
    </Icon>
  );
}

/** Dash in a circle — a SKIPPED rule (capability unavailable). */
export function MinusCircleIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12h7" />
    </Icon>
  );
}

/** Clock — the evaluation-latency readout. */
export function ClockIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 1.8" />
    </Icon>
  );
}

/** Four-point spark — the AI-contribution note. */
export function SparkIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M12 4c.4 3.6 1.4 4.6 5 5-3.6.4-4.6 1.4-5 5-.4-3.6-1.4-4.6-5-5 3.6-.4 4.6-1.4 5-5Z" />
    </Icon>
  );
}

/** Bare check — the selected-option indicator in the custom select. */
export function CheckIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="m5 12.5 4.5 4.5L19 7" />
    </Icon>
  );
}

/** Clipboard with a check — the RM "Evaluate" nav item. */
export function ClipboardCheckIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="6" y="4.5" width="12" height="16" rx="2" />
      <path d="M9 4.5V3.5h6v1" />
      <path d="m9.5 12.5 1.8 1.8 3.7-3.8" />
    </Icon>
  );
}

/** Stacked rows — the "Decisions" (ledger list) nav item. */
export function LedgerRowsIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <rect x="4" y="5" width="16" height="14" rx="2" />
      <path d="M4 9.5h16M9 9.5V19" />
    </Icon>
  );
}

/** Speech bubble — the "Copilot" (ask-the-ledger query) nav item. A deliberately non-AI glyph: the copilot
 *  retrieves and counts, it does not generate, so an "ask" bubble reads truer than a spark. */
export function ChatIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H9l-4 3v-3H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5Z" />
      <path d="M8 10h8M8 13h5" />
    </Icon>
  );
}

/** Bar chart — the "Compliance" (dashboard) nav item. */
export function ChartBarIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M4 20h16" />
      <path d="M7 20v-6M12 20V8M17 20v-9" />
    </Icon>
  );
}

/** Door with an out-arrow — the "Sign out" action. */
export function LogoutIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M14.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h7a1.5 1.5 0 0 0 1.5-1.5v-2.5" />
      <path d="M10 12h9.5m0 0-3-3m3 3-3 3" />
    </Icon>
  );
}

/** Circular arrows — the compliance dashboard's "refresh" action. */
export function RefreshIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M20 11.5A8 8 0 0 0 6.3 6.3L4 8.5" />
      <path d="M4 4.5v4h4" />
      <path d="M4 12.5A8 8 0 0 0 17.7 17.7L20 15.5" />
      <path d="M20 19.5v-4h-4" />
    </Icon>
  );
}

/** Magnifier — the records-table search field. */
export function SearchIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" />
    </Icon>
  );
}

/** Plain X — the drawer/dialog close affordance (distinct from {@link XCircleIcon}, a rule FAIL). */
export function CloseIcon({ className }: IconProps) {
  return (
    <Icon className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}
