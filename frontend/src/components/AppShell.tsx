/**
 * The authenticated app shell — a frosted sidebar rail + sticky frosted topbar wrapping every signed-in
 * screen (UI Modernization Directive §5). Replaces the old top-only AppHeader: a left rail is
 * the single biggest "finished product" signal, and a sticky frosted topbar lets tall content (a
 * FLAGGED verdict) visibly scroll *under* the frost — the everyday proof the glass is real.
 *
 * LAYOUT: `[ rail | (topbar / scrolling main) ]`. The rail is `.glass` with the `--glass-sidebar`
 * override (one step darker than the topbar); it holds the SG mark, the role's nav, and — pinned at the
 * bottom — the user chip and the destructive Sign-out button. The topbar carries the page title (left)
 * and the data-source badge + identity (right). Both rail and topbar are `sticky`.
 *
 * ROLE-DRIVEN NAV (no router — brief §14 keeps routing to a conditional render): the rail is derived from
 * the role. RM now has TWO live screens — Evaluate (workbench) + Prospects (the advisory co-pilot) — plus a
 * Decisions entry still shown *disabled* with a "Phase 2" chip (honesty rule §2.6, never a clickable
 * mockup); Customer sees My investments (active) — a single read-only entry, no action items. Compliance
 * also has TWO live screens — Compliance (dashboard) + Copilot (ask-the-ledger). Multi-screen roles are
 * reached via the optional {@link NavHandlers} the {@link ../App} passes down: those items become real
 * buttons and the active one is derived from {@link NavHandlers.activeKey}. A role with a single live screen
 * omits NavHandlers and keeps the static active/disabled indicators.
 *
 * MOTION: the nav items stagger in once per login (§7 item 1) — this component mounts once when the
 * authenticated face renders. All offsets collapse under `useReducedMotion`.
 *
 * WHERE IT FITS: rendered by {@link ../screens/RmWorkbench} and {@link ../screens/ComplianceDashboard},
 * each passing its own `title` + content as children. Reads the session via {@link ../auth/useAuth}.
 *
 * SAFE EXTENSION: when a Phase-2 screen ships, flip its nav item from disabled to an active/linkable
 * entry (introduce a router at that point, not before). REGRESSION TO AVOID: do not apply `.glass` to
 * the page content this shell wraps — glass is chrome only (§3a); the verdict banner + ledger stay opaque.
 */
import type { ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";

import { useAuth } from "../auth/useAuth";
import { springGentle, springSnappy } from "../motion";

import {
  ChartBarIcon,
  ChatIcon,
  ClipboardCheckIcon,
  LedgerRowsIcon,
  LogoutIcon,
  SearchIcon,
} from "./icons";

/** Maps a backend authority to a short human label (the shape the former AppHeader used). */
const ROLE_LABELS: Record<string, string> = {
  ROLE_RM: "Relationship Manager",
  ROLE_COMPLIANCE: "Compliance",
  ROLE_CUSTOMER: "Customer",
};

/** One rail entry. `active` = the role's live screen; `disabled` = a Phase-2 area, never clickable. */
interface NavItem {
  readonly key: string;
  readonly label: string;
  readonly Icon: typeof ClipboardCheckIcon;
  readonly active: boolean;
  readonly disabled: boolean;
}

/**
 * In-app navigation for a role with more than one live screen (currently only COMPLIANCE: dashboard +
 * copilot). When present, the matching nav items become real buttons and the active one is derived from
 * {@link NavHandlers.activeKey}; roles with a single screen omit this and keep the static active/disabled
 * indicators (still no router — brief §14 — this is a conditional render lifted to {@link ../App}).
 */
export interface NavHandlers {
  /** The key of the currently shown screen (highlights that nav item). */
  readonly activeKey: string;
  /** Switch to the screen for a nav key. */
  readonly onNavigate: (key: string) => void;
}

/** The rail entries for a role — active screen first, Phase-2 areas after (honesty §2.6). */
function navItemsFor(role: string | null): readonly NavItem[] {
  if (role === "ROLE_COMPLIANCE") {
    // Two live screens now — both reachable via NavHandlers (the supervisor's dashboard + the copilot).
    return [
      { key: "compliance", label: "Compliance", Icon: ChartBarIcon, active: true, disabled: false },
      { key: "copilot", label: "Ledger Copilot", Icon: ChatIcon, active: false, disabled: false },
    ];
  }
  if (role === "ROLE_CUSTOMER") {
    // The investor's transparency portal — one read-only screen, no action items by design.
    return [{ key: "my", label: "My investments", Icon: LedgerRowsIcon, active: true, disabled: false }];
  }
  // ROLE_RM — two live screens now (Prospects co-pilot + Evaluate workbench), both reachable via the
  // NavHandlers App's RmWorkspace passes down; Decisions stays a disabled Phase-2 stub (honesty §2.6).
  // Prospects is the topmost item AND the default landing screen (discovery → evaluate → submit).
  return [
    { key: "prospects", label: "Prospects", Icon: SearchIcon, active: true, disabled: false },
    { key: "evaluate", label: "Evaluate", Icon: ClipboardCheckIcon, active: false, disabled: false },
    { key: "decisions", label: "Decisions", Icon: LedgerRowsIcon, active: false, disabled: true },
  ];
}

/** Props for {@link AppShell}. */
interface AppShellProps {
  /** Page title shown at the top-left of the sticky topbar. */
  readonly title: string;
  /** The screen's content, rendered in the scrolling main column. */
  readonly children: ReactNode;
  /** In-app navigation for multi-screen roles; when omitted, nav items stay static indicators. */
  readonly nav?: NavHandlers;
}

/** Sidebar + topbar chrome around an authenticated screen. */
export function AppShell({ title, children, nav }: AppShellProps) {
  const { role, username, logout } = useAuth();
  const reduceMotion = useReducedMotion();
  const roleLabel = role ? (ROLE_LABELS[role] ?? role) : "";
  const items = navItemsFor(role);

  const navItem = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 8 },
    show: { opacity: 1, y: 0, transition: springGentle },
  };

  return (
    <div className="flex min-h-svh">
      {/* ── Rail ─────────────────────────────────────────────────────────────── */}
      <aside className="glass glass-rail sticky top-0 z-40 flex h-svh w-17 shrink-0 flex-col px-3 py-4 lg:w-58">
        {/* SG mark (login's wordmark treatment) */}
        <div className="flex items-center gap-2.5 px-1">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-[13px] font-bold text-white ring-1 ring-primary-bright/40">
            SG
          </div>
          <span className="hidden text-[15px] tracking-tight text-ink lg:inline">
            <span className="font-semibold">Suitability</span>
            <span className="font-light text-muted">Gate</span>
          </span>
        </div>

        {/* Nav — staggers in once per login */}
        <motion.ul
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.06 } } }}
          className="mt-7 flex flex-col gap-1.5"
        >
          {items.map(({ key, label, Icon, active, disabled }) => {
            // With NavHandlers the active screen is derived from the current key and items are clickable;
            // without it (single-screen roles) the static `active` flag drives the indicator, as before.
            const isActive = nav ? nav.activeKey === key : active;
            return (
              <motion.li key={key} variants={navItem}>
                {disabled ? (
                  // Honesty rule: a Phase-2 area is a non-interactive row at 40% opacity, never a button.
                  <div
                    aria-disabled="true"
                    className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 opacity-40"
                  >
                    <Icon className="h-5 w-5 shrink-0 text-muted" />
                    <span className="hidden text-sm font-medium text-ink lg:inline">{label}</span>
                    <span className="ml-auto hidden rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-semibold tracking-wide text-muted uppercase lg:inline">
                      Phase 2
                    </span>
                  </div>
                ) : nav ? (
                  // Clickable in-app nav (multi-screen role): active item is the teal pill, others muted.
                  <button
                    type="button"
                    onClick={() => nav.onNavigate(key)}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-primary-bright/50 focus-visible:outline-none ${
                      isActive
                        ? "bg-primary text-white shadow-sm"
                        : "text-muted hover:bg-surface-2 hover:text-ink"
                    }`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className={`hidden lg:inline ${isActive ? "text-sm font-semibold" : "text-sm font-medium"}`}>
                      {label}
                    </span>
                  </button>
                ) : isActive ? (
                  <div
                    aria-current="page"
                    className="flex items-center gap-3 rounded-lg bg-primary px-3 py-2.5 text-white shadow-sm"
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="hidden text-sm font-semibold lg:inline">{label}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-muted">
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="hidden text-sm font-medium lg:inline">{label}</span>
                  </div>
                )}
              </motion.li>
            );
          })}
        </motion.ul>

        {/* Bottom cluster: user chip + destructive Sign out (diagram pins these to the rail bottom) */}
        <div className="mt-auto flex flex-col gap-3">
          <div className="hidden border-t border-(--glass-line) pt-3 lg:block">
            <div className="truncate px-1 text-[13px] font-medium text-ink">{username}</div>
            <div className="truncate px-1 text-[11px] text-muted">{roleLabel}</div>
          </div>
          <motion.button
            type="button"
            onClick={logout}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
            transition={springSnappy}
            className="flex h-10 items-center justify-center gap-2 rounded-lg bg-danger-strong px-3 text-sm font-semibold text-white transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-danger-strong/60 focus-visible:outline-none"
          >
            <LogoutIcon className="h-4.5 w-4.5 shrink-0" />
            <span className="hidden lg:inline">Sign out</span>
          </motion.button>
        </div>
      </aside>

      {/* ── Content column ───────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass sticky top-0 z-30 flex items-center justify-between gap-4 px-5 py-3 sm:px-8">
          <h1 className="truncate text-lg font-semibold text-ink">{title}</h1>
          <div className="flex items-center gap-4">
            <span className="hidden rounded-full bg-primary-tint px-2.5 py-1 text-[11px] font-medium text-primary-bright sm:inline-flex">
              Data source: SYNTHETIC · IDBI adapter: ready
            </span>
            <div className="text-right leading-tight">
              <div className="text-[13px] font-medium text-ink">{username}</div>
              <div className="text-[11px] text-muted">{roleLabel}</div>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
