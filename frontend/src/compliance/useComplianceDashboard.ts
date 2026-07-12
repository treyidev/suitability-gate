/**
 * The compliance dashboard's data hook — fetch the ledger, derive metrics, expose loading/ready/error.
 *
 * WHY A HOOK (and why here is the swap point): it isolates the ComplianceDashboard screen from HOW the
 * metrics are obtained. Today it fetches the whole ledger and folds it client-side via
 * {@link deriveComplianceMetrics}. In Phase 2.2, aggregation can move server-side: swap the body to call a
 * {@code GET /dashboard/*} endpoint that returns {@link ComplianceMetrics} directly, and neither the screen
 * nor any widget changes. The hook is the seam the whole "least backend now, full backend later" plan rests on.
 *
 * WHERE IT FITS: {@code fetchRecords} (api/client) → this hook → the ComplianceDashboard screen.
 *
 * Race safety: each run owns an AbortController; a reload or unmount aborts the in-flight request and a
 * `cancelled` guard drops any late resolution, so stale data can never overwrite fresh (the classic
 * out-of-order async render bug). An aborted fetch (`AbortError`) is a quiet no-op, never an error state.
 */
import { useCallback, useEffect, useState } from "react";

import { ApiError, fetchRecords } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { deriveComplianceMetrics } from "./compliance-metrics";
import type { ComplianceMetrics } from "./compliance-metrics";

/** The dashboard's data state — a discriminated union so the screen renders exactly one branch. */
export type ComplianceDashboardState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly metrics: ComplianceMetrics }
  | { readonly status: "error"; readonly message: string };

/** What {@link useComplianceDashboard} returns: the current state plus a manual refresh action. */
export interface ComplianceDashboard {
  readonly state: ComplianceDashboardState;
  /** Re-fetch and re-derive (a dashboard refresh button); aborts any in-flight load first. */
  readonly reload: () => void;
}

/**
 * Load and aggregate the decision ledger for the compliance dashboard.
 *
 * Requires an authenticated ROLE_COMPLIANCE session (the screen only mounts under one); a missing token
 * surfaces as an error state rather than a silent empty dashboard (fail-fast).
 *
 * @returns the dashboard data state and a {@link ComplianceDashboard.reload} action
 */
export function useComplianceDashboard(): ComplianceDashboard {
  const { token } = useAuth();
  const [state, setState] = useState<ComplianceDashboardState>({ status: "loading" });
  // Bumping this re-runs the effect — a manual reload without re-mounting the screen.
  const [reloadNonce, setReloadNonce] = useState(0);

  const reload = useCallback(() => {
    setReloadNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (token === null) {
      setState({ status: "error", message: "No active session — please sign in again." });
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setState({ status: "loading" });

    fetchRecords(token, controller.signal)
      .then((records) => {
        if (cancelled) {
          return;
        }
        setState({ status: "ready", metrics: deriveComplianceMetrics(records) });
      })
      .catch((error: unknown) => {
        // An aborted request (reload/unmount) is a quiet revert, not a failure to surface.
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        const message =
          error instanceof ApiError
            ? error.message
            : "Could not load the decision ledger. Check the backend is running.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, reloadNonce]);

  return { state, reload };
}
