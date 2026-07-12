/**
 * House spring presets (UI Modernization Directive §7) — the single place spring-physics constants
 * are defined for the whole frontend.
 *
 * Why one file: the directive moves all transitions onto `motion` springs (Apple's motion model) and
 * mandates that no component inline ad-hoc stiffness/damping numbers. Centralising the two presets
 * here means every animated transition imports one of them, so the whole product's motion reads as
 * one consistent material rather than per-widget guesswork — and re-tuning the feel is a one-file
 * edit, mirroring the theme.css one-file-swap discipline for colour.
 *
 * Usage: `import { springGentle } from "../motion";` then pass as a `transition` prop, e.g.
 *   <motion.div transition={springGentle} … />
 *
 * WHERE IT FITS: presentation layer only; consumed by animated components (later phases wire these
 * into the shell mount, verdict swap, control micro-interactions, etc.). Nothing imports it yet in
 * P0 — it is created now so later phases have the single source of truth to import from.
 *
 * SAFE EXTENSIONS: add further named presets here (e.g. a slower `springLede` for large layout
 * moves) as the motion budget grows. REGRESSION TO AVOID: do not inline raw spring numbers in a
 * component — that fragments the motion language this file exists to keep coherent.
 *
 * `as const` freezes each preset's shape so `type: "spring"` narrows to the literal `motion`
 * expects, not the wider `string`.
 */

/** Entrances + layout moves — a soft settle with at most one small overshoot (directive §7). */
export const springGentle = { type: "spring", stiffness: 260, damping: 26 } as const;

/** Micro-interactions — press, toggles, the segmented-control thumb; snappier, tighter settle. */
export const springSnappy = { type: "spring", stiffness: 420, damping: 30 } as const;
