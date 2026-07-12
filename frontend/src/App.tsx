/**
 * The root view switch — the app's "one app, role-gated faces" routing (brief §14), done without a router
 * library: authenticated screens plus a login gate is a conditional render, and adding react-router would be
 * indirection YAGNI at this size. If deep-linking is ever needed, that is the point to introduce a router.
 *
 * Reads only the auth session: no token ⇒ login; ROLE_COMPLIANCE ⇒ the compliance workspace (dashboard +
 * copilot); ROLE_CUSTOMER ⇒ the read-only customer transparency portal; otherwise the RM workbench.
 */
import { useState } from "react";

import type { Prospect, ProposedPlan } from "./api/types";
import { useAuth } from "./auth/useAuth";
import { ComplianceCopilot } from "./screens/ComplianceCopilot";
import { ComplianceDashboard } from "./screens/ComplianceDashboard";
import { CustomerDashboard } from "./screens/CustomerDashboard";
import { LoginScreen } from "./screens/LoginScreen";
import { RmProspects } from "./screens/RmProspects";
import { RmWorkbench } from "./screens/RmWorkbench";

/** Chooses the screen for the current session. */
function App() {
  const { token, role } = useAuth();

  if (!token) {
    return <LoginScreen />;
  }
  if (role === "ROLE_COMPLIANCE") {
    return <ComplianceWorkspace />;
  }
  if (role === "ROLE_CUSTOMER") {
    return <CustomerDashboard />;
  }
  return <RmWorkspace />;
}

/**
 * The ROLE_RM face — two live screens (the Evaluate workbench + the Prospects co-pilot) switched by the
 * AppShell rail, the same "conditional render, no router" pattern as {@link ComplianceWorkspace} lifted for
 * the role that now has more than one screen. State lives here so it survives switching between the two
 * child screens (each unmounts on switch): the {@link prefill} a Prospects card hands to the workbench, and
 * the {@link dismissed} set of customers the RM has already submitted this session (their Prospects card
 * "goes away"). Mounts on an RM session, unmounts — and so resets — on logout.
 *
 * Reaching Evaluate via the rail (not via a card) drops any stale prefill, so the nav gives a clean form;
 * reaching it via a card seeds it. Because the inactive screen unmounts, an in-progress form is not
 * preserved across a manual rail switch — acceptable here (the primary path is card → Evaluate → Submit in
 * one direction), and consistent with the compliance workspace's dashboard↔copilot switch.
 */
function RmWorkspace() {
  // Land on Prospects (the topmost rail item) — the RM's flow starts with discovery, then Evaluate → Submit.
  const [view, setView] = useState<"evaluate" | "prospects">("prospects");
  const [prefill, setPrefill] = useState<{ customerId: string; plan: ProposedPlan } | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());

  const nav = {
    activeKey: view,
    onNavigate: (key: string) => {
      if (key === "prospects") {
        setView("prospects");
      } else {
        // Reaching Evaluate via the rail (not a Prospects card) starts a clean form — drop any stale prefill.
        setPrefill(null);
        setView("evaluate");
      }
    },
  };

  // A Prospects card hands its customer + suggested plan to the workbench and switches to it.
  function selectProspect(prospect: Prospect): void {
    setPrefill({ customerId: prospect.customer.customerId, plan: prospect.plan });
    setView("evaluate");
  }

  // The workbench reports a committed submission; that customer's Prospects card is dropped for the session.
  function markSubmitted(customerId: string): void {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(customerId);
      return next;
    });
  }

  return view === "prospects" ? (
    <RmProspects nav={nav} dismissed={dismissed} onSelect={selectProspect} />
  ) : (
    <RmWorkbench nav={nav} prefill={prefill} onSubmitted={markSubmitted} />
  );
}

/**
 * The ROLE_COMPLIANCE face — two live screens (dashboard + copilot) switched by the AppShell rail. State
 * lives here (mounts on a compliance session, unmounts on logout) so the view resets naturally between
 * sessions; the nav key doubles as the view id, so switching is one setState. This is the "conditional
 * render, no router" pattern (brief §14) lifted one level for the role that now has more than one screen.
 */
function ComplianceWorkspace() {
  const [view, setView] = useState<"compliance" | "copilot">("compliance");
  const nav = { activeKey: view, onNavigate: (key: string) => setView(key === "copilot" ? "copilot" : "compliance") };
  return view === "copilot" ? <ComplianceCopilot nav={nav} /> : <ComplianceDashboard nav={nav} />;
}

export default App;
