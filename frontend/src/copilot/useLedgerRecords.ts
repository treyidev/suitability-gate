/**
 * The Compliance Copilot's data hook — fetch the whole decision ledger as RAW records for the query engine.
 *
 * WHY A SEPARATE HOOK (not the dashboard's {@link ../compliance/useComplianceDashboard}): that hook folds the
 * ledger into {@link ../compliance/compliance-metrics.ComplianceMetrics} (verdict/rule aggregates + flattened
 * table rows) — it deliberately throws away the raw {@link DecisionRecord}s. The copilot's parser needs the
 * FULL records (it filters on {@code customerSnapshot.seniorCitizen}, {@code riskCategory},
 * {@code schemeSnapshot.riskometerLevel}, {@code overrides}, {@code createdAt} — fields the flat rows drop).
 * Generalising the dashboard hook to also expose raw records would touch a locked, working screen for no
 * gain; a small dedicated hook that mirrors its proven race-safety is the smaller, contained diff.
 *
 * WHERE IT FITS: {@code fetchRecords} (api/client, COMPLIANCE-only whole-ledger read) → this hook → the
 * {@link ../screens/ComplianceCopilot} screen → {@link ../copilot/queryEngine.runLedgerQuery}.
 *
 * Race safety (identical contract to the dashboard hook): each run owns an AbortController; a reload or
 * unmount aborts the in-flight request and a {@code cancelled} guard drops any late resolution, so stale
 * data can never overwrite fresh. An aborted fetch (AbortError) is a quiet no-op, never an error state.
 */
import { useCallback, useEffect, useState } from "react";

import { ApiError, fetchRecords } from "../api/client";
import { useAuth } from "../auth/useAuth";
import type { DecisionRecord } from "../api/types";

/** The copilot's data state — a discriminated union so the screen renders exactly one branch. */
export type LedgerRecordsState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly records: readonly DecisionRecord[] }
  | { readonly status: "error"; readonly message: string };

/** What {@link useLedgerRecords} returns: the current state plus a manual refresh action. */
export interface LedgerRecords {
  readonly state: LedgerRecordsState;
  /** Re-fetch the ledger; aborts any in-flight load first. */
  readonly reload: () => void;
}

/**
 * Load the whole decision ledger as raw records for the compliance copilot.
 *
 * Requires an authenticated ROLE_COMPLIANCE session (the screen only mounts under one); a missing token
 * surfaces as an error state rather than a silent empty ledger (fail-fast).
 *
 * @returns the ledger data state and a {@link LedgerRecords.reload} action
 */
export function useLedgerRecords(): LedgerRecords {
  const { token } = useAuth();
  const [state, setState] = useState<LedgerRecordsState>({ status: "loading" });
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
        setState({ status: "ready", records });
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
