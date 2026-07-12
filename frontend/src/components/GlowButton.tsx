/**
 * The primary action button — ONE teal gradient control shared by Sign in and Evaluate (owner-directed
 * 2026-07-11: "the same button reused in the login screen as well"; UI Modernization Directive §5a/§5b).
 *
 * Owns the full primary-button language so there is a single source of truth, no parallel
 * implementations:
 *  - teal gradient fill + inset top sheen (`.btn-primary-fill`);
 *  - hover-lift 1.02 / press 0.98 springs from {@link ../motion} (gated on `useReducedMotion`);
 *  - the §5b "working border" busy state: a hot-core light band that ignites at the top-left corner and
 *    sweeps clockwise, with an outer bloom (all in `theme.css`), plus `aria-busy`, a double-submit lock,
 *    and a label swap with NO spinner glyph and NO layout shift (the trailing arrow keeps its box via
 *    `opacity-0`, per owner directive). Reduced motion falls back to the static bright-ring variant.
 *
 * BUSY vs DISABLED are distinct: `busy` is in-flight (glowing, locked, full opacity); `disabled` is
 * not-yet-submittable (dimmed 50%, locked). While busy the button is NOT dimmed — the glow must read.
 *
 * WHERE IT FITS: {@link ../screens/LoginScreen} (type="submit") and {@link ../screens/RmWorkbench}
 * (type="button" + onClick). Each screen owns its own in-flight state + the ~1s minimum busy hold that
 * keeps the glow visible; this component only renders the state it is given.
 */
import { motion, useReducedMotion } from "motion/react";

import { springSnappy } from "../motion";

import { ArrowRightIcon } from "./icons";

/** Props for {@link GlowButton}. */
interface GlowButtonProps {
  /** Idle label. */
  readonly label: string;
  /** In-flight label (shown while `busy`); dims slightly, never accompanied by a spinner. */
  readonly busyLabel: string;
  /** True while a real operation is in flight — drives the working border + `aria-busy` + the lock. */
  readonly busy: boolean;
  /** Not-yet-submittable (e.g. required fields empty). Dims to 50% and locks; ignored while `busy`. */
  readonly disabled?: boolean;
  /** `submit` for a form (Sign in); `button` + `onClick` for an imperative action (Evaluate). */
  readonly type?: "button" | "submit";
  /** Click handler for `type="button"`. */
  readonly onClick?: () => void;
}

/** The shared primary button with the gradient fill + working-border busy state. */
export function GlowButton({
  label,
  busyLabel,
  busy,
  disabled = false,
  type = "button",
  onClick,
}: GlowButtonProps) {
  const reduceMotion = useReducedMotion();
  const locked = busy || disabled; // double-submit + not-ready both block the click
  const interactive = !reduceMotion && !locked;
  // The working border is truthful status (only while genuinely busy) — static under reduced motion.
  const border = busy ? (reduceMotion ? "working-border-static" : "working-border") : "";
  // Dim ONLY when disabled-and-not-busy; a busy button stays full opacity so the glow reads.
  const dim = busy ? "cursor-default" : "disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={locked}
      aria-busy={busy}
      whileHover={interactive ? { scale: 1.02 } : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      transition={springSnappy}
      className={`btn-primary-fill group flex h-11 w-full items-center justify-center gap-2 rounded-lg text-[15px] font-semibold text-white focus-visible:ring-3 focus-visible:ring-primary-bright/40 focus-visible:outline-none ${dim} ${border}`}
    >
      <span className={busy ? "opacity-80" : ""}>{busy ? busyLabel : label}</span>
      {/* Trailing arrow keeps its box while busy (opacity-0) so the button never changes size. */}
      <ArrowRightIcon
        className={`h-4 w-4 transition-transform ${busy ? "opacity-0" : "group-hover:translate-x-0.5"}`}
      />
    </motion.button>
  );
}
