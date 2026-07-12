/**
 * The drill-down modal — a centered popup showing one decision's full record over a frosted dashboard.
 *
 * WHY A CENTERED MODAL (owner decision 2026-07-11, superseding the earlier narrow right-drawer): the
 * record is content-rich ({@link ../components/VerdictCard} — banner, SEBI gauge, provenance, rule audit,
 * AI footer) and the dashboard behind is unusable while it's open anyway, so a cramped side panel added
 * nothing. A wide centred card (sized to VerdictCard's natural width, not stretched full-page) reads best;
 * the backdrop is genuine frosted glass — `backdrop-blur` over the dashboard, not a flat dim — so the app
 * visibly pauses behind it (the Liquid Glass language, §3a: this overlay is a sanctioned glass surface).
 * The record card inside stays opaque (no glass-on-glass, §1b). Closing returns to the dashboard untouched.
 *
 * The full record (with its async explanation prose overlaid) is fetched by id via {@code fetchRecord} —
 * NOT taken from the list, which omits the explanation. Race-safe: switching rows or closing aborts the
 * in-flight fetch. Dialog semantics: role=dialog + aria-modal, Escape and backdrop-click close, focus moves
 * to the close button on open.
 *
 * WHERE IT FITS: mounted by {@link ../screens/ComplianceDashboard} inside an {@code AnimatePresence} while
 * a row is selected; re-fetches whenever {@link RecordModalProps.recordId} changes.
 */
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

import { ApiError, fetchRecord, submitOverride } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { springGentle } from "../motion";
import { CloseIcon } from "../components/icons";
import { VerdictCard } from "../components/VerdictCard";
import type { DecisionRecord, OverrideStatus } from "../api/types";

/** Props for {@link RecordModal}. */
interface RecordModalProps {
  /** The record to show (drives the fetch); the modal is only mounted when this is non-null. */
  readonly recordId: string;
  /** Close the modal. */
  readonly onClose: () => void;
  /** Called after a supervisor review is recorded, so the dashboard can refresh the table's reviewed chip. */
  readonly onReviewed?: () => void;
}

/** Fetch state for the modal's single record. */
type ModalState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly record: DecisionRecord }
  | { readonly status: "error"; readonly message: string };

/** Centered popup showing one decision's full record over a frosted dashboard. */
export function RecordModal({ recordId, onClose, onReviewed }: RecordModalProps) {
  const { token } = useAuth();
  const reduceMotion = useReducedMotion();
  const [state, setState] = useState<ModalState>({ status: "loading" });
  // Local mirror of VerdictCard's "stopped watching" — a historical record is not polled here, but the
  // card's contract needs it (a still-PENDING record can be dismissed to the quiet STOPPED state).
  const [watchStopped, setWatchStopped] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Fetch the full record (with explanation overlay) by id; race-safe on recordId change / unmount.
  useEffect(() => {
    if (token === null) {
      setState({ status: "error", message: "No active session." });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setState({ status: "loading" });
    setWatchStopped(false);

    fetchRecord(token, recordId, controller.signal)
      .then((record) => {
        if (!cancelled) {
          setState({ status: "ready", record });
        }
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        const message = error instanceof ApiError ? error.message : "Could not load this record.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [recordId, token]);

  // Escape closes; move focus to the close button on open (dialog focus handling).
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Record a supervisor review; on success append it to the shown record (so the review block replaces the
  // form) and tell the dashboard to refresh its table chip. Rejects with the API error so the form shows it.
  async function handleReview(action: OverrideStatus, justification: string): Promise<void> {
    if (token === null) {
      throw new Error("No active session.");
    }
    const event = await submitOverride(token, recordId, action, justification);
    setState((prev) =>
      prev.status === "ready"
        ? { status: "ready", record: { ...prev.record, overrides: [...prev.record.overrides, event] } }
        : prev,
    );
    onReviewed?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Frosted backdrop — blurs the dashboard behind (not a flat dim), so the app visibly pauses. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-canvas/45 backdrop-blur-md"
        aria-hidden="true"
      />

      {/* Panel — a wide centred card, scale-in. */}
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label="Decision record"
        initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.96, y: reduceMotion ? 0 : 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: reduceMotion ? 1 : 0.97 }}
        transition={springGentle}
        className="relative z-10 flex max-h-[88vh] w-full max-w-2xl flex-col"
      >
        {/* Floating close — stays put while the record scrolls; readable on the coloured banner and the
            dark card body alike (solid inset pill + ring + light icon). */}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-surface-2/90 text-ink ring-1 ring-line backdrop-blur transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary-bright/60 focus-visible:outline-none"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        {/* Scrolls internally when the record is taller than the viewport. */}
        <div className="min-h-0 overflow-y-auto">
          {state.status === "loading" && (
            <div className="flex h-48 items-center justify-center rounded-xl border border-line bg-surface text-sm text-muted">
              Loading record…
            </div>
          )}
          {state.status === "error" && (
            <div className="rounded-xl border border-danger-bright/25 bg-danger-tint px-5 py-4 text-[13px] text-danger-bright">
              {state.message}
            </div>
          )}
          {state.status === "ready" && (
            <VerdictCard
              record={state.record}
              explanationWatchStopped={watchStopped}
              onStopWaiting={() => setWatchStopped(true)}
              onReview={handleReview}
            />
          )}
        </div>
      </motion.aside>
    </div>
  );
}
