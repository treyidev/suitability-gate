/**
 * Access the current authenticated session.
 *
 * Fail-fast: throws if used outside {@code <AuthProvider>} (context is `null` there) so a wiring
 * mistake surfaces immediately instead of as a confusing `Cannot read properties of null`.
 */
import { useContext } from "react";

import { AuthContext } from "./auth-context";
import type { AuthState } from "./auth-context";

/** @returns the current {@link AuthState}; never null. */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth must be used within <AuthProvider>");
  }
  return context;
}
