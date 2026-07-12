/**
 * The RM "Prospects" co-pilot data hook — loads the advisory worklist ({@code GET /prospects}) race-safely.
 *
 * WHY IT MIRRORS {@link ../copilot/useLedgerRecords}: that hook is a proven, contained race-safe loader; the
 * prospects screen needs the same contract (loading / ready / error + manual reload), so this is a small
 * dedicated copy rather than a generalisation of a working hook that fetches a different endpoint and shape.
 *
 * Race safety (identical contract): each run owns an AbortController; a reload or unmount aborts the
 * in-flight request and a {@code cancelled} guard drops any late resolution, so stale data can never
 * overwrite fresh. An aborted fetch (AbortError) is a quiet no-op, never an error state.
 *
 * WHERE IT FITS: {@code fetchProspects} (api/client, RM-only) → this hook → the {@link ../screens/RmProspects}
 * screen. The screen owns the "already acted on this session" dismissal (a submitted row disappears); this
 * hook only loads and exposes a manual {@link Prospects.reload} so returning to the screen can re-derive
 * fresh/served from the server.
 */
import { useCallback, useEffect, useState } from "react";

import { ApiError, fetchProspects } from "../api/client";
import { useAuth } from "../auth/useAuth";
import type { Prospect } from "../api/types";

/** The prospects data state — a discriminated union so the screen renders exactly one branch. */
export type ProspectsState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly prospects: readonly Prospect[] }
  | { readonly status: "error"; readonly message: string };

/** What {@link useProspects} returns: the current state plus a manual refresh action. */
export interface Prospects {
  readonly state: ProspectsState;
  /** Re-fetch the worklist; aborts any in-flight load first. */
  readonly reload: () => void;
}

/**
 * Load the RM prospect worklist. Requires an authenticated ROLE_RM session (the screen only mounts under
 * one); a missing token surfaces as an error state rather than a silent empty list (fail-fast).
 *
 * @returns the worklist data state and a {@link Prospects.reload} action
 */
export function useProspects(): Prospects {
  const { token } = useAuth();
  const [state, setState] = useState<ProspectsState>({ status: "loading" });
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

    fetchProspects(token, controller.signal)
      .then((prospects) => {
        if (cancelled) {
          return;
        }
        setState({ status: "ready", prospects });
      })
      .catch((error: unknown) => {
        // An aborted request (reload/unmount) is a quiet revert, not a failure to surface.
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        const message =
          error instanceof ApiError
            ? error.message
            : "Could not load the prospect worklist. Check the backend is running.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, reloadNonce]);

  return { state, reload };
}
