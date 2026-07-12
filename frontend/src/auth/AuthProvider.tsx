/**
 * Holds the authenticated session for the app and exposes it via {@link AuthContext}.
 *
 * LIFECYCLE / DESIGN: the token lives in React state only — deliberately NOT in localStorage or a
 * cookie. For a bank-facing demo, keeping the JWT out of persistent web storage is the more defensible
 * default (no XSS-readable token at rest); the cost is that a full page refresh logs the user out,
 * which is acceptable for the demo. If "survive refresh" is later wanted, sessionStorage is the swap
 * point — flag the security trade-off when doing so.
 *
 * WHERE IT FITS: wraps {@code <App>} in {@link ../main}. Screens read the session through
 * {@link ./useAuth}.
 */
import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { login as apiLogin } from "../api/client";
import type { Role } from "../api/types";

import { AuthContext } from "./auth-context";
import type { AuthState } from "./auth-context";

/** Provides {@link AuthContext} to its subtree. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  const login = useCallback(
    async (
      user: string,
      password: string,
      signal?: AbortSignal,
      minHoldMs = 0,
    ): Promise<void> => {
      // Wait for max(API, minHoldMs) before committing so a fast login still shows the in-flight glow
      // (§5b). Promise.all rejects the instant the API rejects — a failure never waits out the hold.
      const [response] = await Promise.all([
        apiLogin(user, password, signal),
        minHoldMs > 0 ? new Promise<void>((resolve) => setTimeout(resolve, minHoldMs)) : Promise.resolve(),
      ]);
      // The gateway only returns known authorities; narrow the wire `string` to our Role union.
      setToken(response.token);
      setRole(response.role as Role);
      setUsername(user);
    },
    [],
  );

  const logout = useCallback((): void => {
    setToken(null);
    setRole(null);
    setUsername(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ token, role, username, login, logout }),
    [token, role, username, login, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
