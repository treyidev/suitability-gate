/**
 * The authentication context definition — the shared shape and the React context object.
 *
 * Kept in its own module (no component, no hook) so both {@link ./AuthProvider} and {@link ./useAuth}
 * import from here without a circular dependency, and so React Fast Refresh / oxlint's
 * `only-export-components` rule stay happy (a file that exports a component must not also export
 * non-component values).
 */
import { createContext } from "react";

import type { Role } from "../api/types";

/** The authenticated session plus the actions that mutate it. `null` fields ⇒ logged out. */
export interface AuthState {
  /** Current JWT, or `null` when logged out. */
  readonly token: string | null;
  /** Granted role, or `null` when logged out. */
  readonly role: Role | null;
  /** The username that logged in (the login response omits it, so it's captured from the form). */
  readonly username: string | null;
  /**
   * Authenticate and store the session; throws (ApiError) on failure so the form can show it. An
   * optional abort signal backs the login form's >2s progressive-disclosure cancel (§5b): aborting
   * rejects with `AbortError`, which the form treats as a quiet revert rather than an error.
   *
   * `minHoldMs` (caller-supplied, presentation staging — §5b amendment) delays committing the session
   * until BOTH the API call AND this minimum have elapsed, so the in-flight glow stays visible on a
   * sub-second login (the screen unmounts the instant the session commits, so the hold must gate the
   * commit — it cannot live purely in the form). On API failure the promise rejects immediately; the
   * hold never delays an error.
   */
  readonly login: (
    username: string,
    password: string,
    signal?: AbortSignal,
    minHoldMs?: number,
  ) => Promise<void>;
  /** Clear the session. */
  readonly logout: () => void;
}

/**
 * Null until a provider mounts — {@link ./useAuth} throws if consumed outside {@code <AuthProvider>},
 * turning a wiring mistake into a loud, immediate error rather than silent undefined behaviour.
 */
export const AuthContext = createContext<AuthState | null>(null);
