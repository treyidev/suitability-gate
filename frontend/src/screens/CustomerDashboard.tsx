/**
 * The ROLE_CUSTOMER face — the investor's read-only transparency portal (customer.demo = Mrs. Sunita Sharma).
 *
 * WHY THIS EXISTS: the bank is a mutual-fund DISTRIBUTOR, not an adviser — "the gate never advises". This
 * screen is the customer-facing proof of that thesis: it shows the investor (1) exactly what the bank holds
 * about them ("what the bank knows about me") and (2) every suitability decision made in their name, with
 * its full "why" — the plain-English rule checks, a plain-language explanation, and the bank's review state.
 * The latter two are shown WITHOUT any AI/provider wording or the internal "supervisor" role framing (owner
 * directive 2026-07-12: the bank's use of a model is not disclosed to the customer). It is TRANSPARENCY ONLY:
 * there is deliberately NO product catalogue, NO suggestion, and NO
 * advice-like surface anywhere here. A customer can look at their own record; they cannot be sold to from it.
 *
 * DATA: both reads are token-scoped server-side — {@code GET /my/profile} and {@code GET /my/records} resolve
 * to the customerId bound into the JWT, so this screen never passes (and cannot tamper with) a customer id.
 * {@code /my/records} arrives with the async explanation prose ALREADY stitched (unlike the compliance list),
 * so a decision's drill-down needs no re-fetch — the customer has no access to {@code /records/{id}} anyway.
 *
 * LAYOUT (top-to-bottom, spring-staggered in, inside the shared AppShell): the profile grid → the decisions
 * list (newest first, each a drill-down) → a quiet thesis footer. A row opens a frosted modal showing the
 * full {@link VerdictCard} in read-only mode (no supervisor action — the customer only ever VIEWS the state).
 *
 * WHERE IT FITS: rendered by {@link ../App} when a ROLE_CUSTOMER session is active. Reuses the RM/compliance
 * visual language (AttributeChip, VerdictCard, the tinted verdict/approval chips, the frosted modal chrome).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ApiError, fetchMyProfile, fetchMyRecords } from "../api/client";
import type { CustomerProfile, DecisionRecord, OverrideStatus, Verdict } from "../api/types";
import { useAuth } from "../auth/useAuth";
import { AppShell } from "../components/AppShell";
import { AttributeChip } from "../components/AttributeChip";
import { CloseIcon, FlagIcon, RefreshIcon, ShieldCheckIcon } from "../components/icons";
import { VerdictCard } from "../components/VerdictCard";
import { formatDate, formatDateTime, formatInr, formatMonths, humanizeLabel } from "../format";
import { springGentle } from "../motion";

/** The portal's data-load lifecycle — profile + records fetched together. */
type PortalState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly profile: CustomerProfile; readonly records: DecisionRecord[] }
  | { readonly status: "error"; readonly message: string };

/** The read-only customer transparency portal. */
export function CustomerDashboard() {
  const { token } = useAuth();
  const [state, setState] = useState<PortalState>({ status: "loading" });
  const [selected, setSelected] = useState<DecisionRecord | null>(null);
  // A monotonically-increasing nonce whose only job is to re-trigger the load effect on Refresh.
  const [reloadNonce, setReloadNonce] = useState(0);
  const reload = useCallback(() => setReloadNonce((n) => n + 1), []);

  // Load the caller's own profile + decisions together; race-safe on unmount / reload (abort + cancelled guard).
  useEffect(() => {
    if (!token) {
      setState({ status: "error", message: "No active session." });
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    setState({ status: "loading" });

    Promise.all([fetchMyProfile(token, controller.signal), fetchMyRecords(token, controller.signal)])
      .then(([profile, records]) => {
        if (!cancelled) {
          setState({ status: "ready", profile, records });
        }
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
        const message = error instanceof ApiError ? error.message : "Could not load your record.";
        setState({ status: "error", message });
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [token, reloadNonce]);

  return (
    <AppShell title="My investments">
      <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
        {state.status === "loading" && (
          <div className="flex h-64 items-center justify-center text-sm text-muted">
            Loading your record…
          </div>
        )}

        {state.status === "error" && (
          <div className="mx-auto max-w-md rounded-xl border border-danger-bright/25 bg-danger-tint px-5 py-4">
            <p className="text-[13px] text-danger-bright">{state.message}</p>
            <button
              type="button"
              onClick={reload}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:brightness-110"
            >
              <RefreshIcon className="h-4 w-4" />
              Try again
            </button>
          </div>
        )}

        {state.status === "ready" && (
          <PortalBody
            profile={state.profile}
            records={state.records}
            onReload={reload}
            onSelect={setSelected}
          />
        )}
      </div>

      {/* Drill-down modal — the full decision, read-only (no supervisor action for a customer). */}
      <AnimatePresence>
        {selected !== null && (
          <RecordDetailModal record={selected} onClose={() => setSelected(null)} />
        )}
      </AnimatePresence>
    </AppShell>
  );
}

/** The populated portal — split out so the ready branch stays declarative (mirrors ComplianceDashboard). */
function PortalBody({
  profile,
  records,
  onReload,
  onSelect,
}: {
  profile: CustomerProfile;
  records: DecisionRecord[];
  onReload: () => void;
  onSelect: (record: DecisionRecord) => void;
}) {
  const reduceMotion = useReducedMotion();
  const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
  const section = {
    hidden: { opacity: 0, y: reduceMotion ? 0 : 12 },
    show: { opacity: 1, y: 0, transition: springGentle },
  };

  return (
    <motion.div initial="hidden" animate="show" variants={container} className="flex flex-col gap-6">
      {/* Sub-header: who this is + refresh */}
      <motion.div variants={section} className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">
          A read-only view of what your bank holds about you, and every suitability decision made in your
          name.
        </p>
        <button
          type="button"
          onClick={onReload}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-2"
        >
          <RefreshIcon className="h-4 w-4 text-muted" />
          Refresh
        </button>
      </motion.div>

      {/* Profile — "what the bank knows about me" */}
      <motion.section variants={section}>
        <SectionHeader>What the bank knows about me</SectionHeader>
        <div className="rounded-xl border border-line bg-surface p-4">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-[15px] font-semibold text-white ring-1 ring-primary-bright/40">
              {Initials(profile.fullName)}
            </div>
            <div>
              <div className="text-[15px] font-semibold text-ink">{profile.fullName}</div>
              <div className="text-[12px] text-muted">
                Branch {profile.branchCode} · {humanizeLabel(profile.sourceSystem)} record
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <AttributeChip label="Age" value={`${profile.ageYears}`} warn={profile.seniorCitizen} />
            <AttributeChip label="Risk profile" value={humanizeLabel(profile.riskCategory)} />
            <AttributeChip label="Profiled on" value={formatDate(profile.riskProfileDate)} />
            <AttributeChip label="Horizon" value={formatMonths(profile.investmentHorizonMonths)} />
            <AttributeChip label="KYC" value={humanizeLabel(profile.kycStatus)} />
            <AttributeChip label="KYC updated" value={formatDate(profile.kycLastUpdated)} />
            <AttributeChip label="Income" value={formatInr(profile.annualIncomeInr)} />
            <AttributeChip label="Assets" value={formatInr(profile.investableAssetsInr)} />
          </div>
        </div>
      </motion.section>

      {/* Decisions — newest first, each a drill-down */}
      <motion.section variants={section}>
        <SectionHeader>
          Decisions made in my name
          <span className="ml-2 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted tabular-nums">
            {records.length}
          </span>
        </SectionHeader>
        {records.length === 0 ? (
          <EmptyDecisions />
        ) : (
          <ul className="flex flex-col gap-2">
            {records.map((record) => (
              <li key={record.recordId}>
                <DecisionRow record={record} onOpen={() => onSelect(record)} />
              </li>
            ))}
          </ul>
        )}
      </motion.section>

      {/* Quiet thesis footer — the transparency claim, in bank-neutral terms (no internal "supervisor" role) */}
      <motion.p variants={section} className="mt-1 text-center text-[12px] leading-relaxed text-muted">
        Every decision above was checked against the bank's suitability rules and reviewed by the bank —
        this is your record of it. The bank distributes funds; it does not advise, and nothing here is a
        recommendation.
      </motion.p>
    </motion.div>
  );
}

/** One decision, as a clickable summary row → opens the full record. */
function DecisionRow({ record, onOpen }: { record: DecisionRecord; onOpen: () => void }) {
  const reviewStatus = record.overrides[0]?.resultingStatus ?? null;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open decision ${record.certificateNumber}`}
      className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary-bright/40 focus-visible:outline-none"
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-ink">{record.schemeSnapshot.name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted">
            <span className="font-mono tabular-nums">{formatInr(record.proposal.amountInr)}</span>
            <span aria-hidden="true">·</span>
            <span>{humanizeLabel(record.proposal.transactionType)}</span>
            <span aria-hidden="true">·</span>
            <span>{formatDateTime(record.createdAt)}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{record.certificateNumber}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <VerdictChip verdict={record.verdict} />
          <ApprovalChip status={reviewStatus} />
        </div>
      </div>
    </button>
  );
}

/**
 * Small tinted verdict pill — teal PASS / red FLAGGED (the locked colour semantics). Mirrors the compliance
 * table's VerdictPill; kept local because that one is private to RecordsTable and reusing it would mean
 * touching the compliance flow (only AttributeChip was in scope for shared extraction).
 */
function VerdictChip({ verdict }: { verdict: Verdict }) {
  if (verdict === "PASS") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-semibold text-primary-bright">
        <ShieldCheckIcon className="h-3.5 w-3.5" />
        Pass
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-danger-tint px-2 py-0.5 text-[11px] font-semibold text-danger-bright">
      <FlagIcon className="h-3.5 w-3.5" />
      Flagged
    </span>
  );
}

/**
 * The decision's human-approval state — Pending (amber) / Approved (teal) / Rejected (red). Mirrors the
 * compliance table's ReviewChip/PendingChip pattern (kept local for the same reason as {@link VerdictChip}).
 */
function ApprovalChip({ status }: { status: OverrideStatus | null }) {
  if (status === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-accent-tint px-2 py-0.5 text-[11px] font-medium text-accent-bright">
        Pending
      </span>
    );
  }
  const approved = status === "APPROVED";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        approved ? "bg-primary-tint text-primary-bright" : "bg-danger-tint text-danger-bright"
      }`}
    >
      {approved ? "Approved" : "Rejected"}
    </span>
  );
}

/** Empty state — an honest "nothing yet", never a nudge to transact. */
function EmptyDecisions() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line bg-surface/60 px-6 py-12 text-center">
      <ShieldCheckIcon className="h-9 w-9 text-line" />
      <p className="mt-3 text-sm font-medium text-ink">No decisions yet</p>
      <p className="mt-1 max-w-sm text-[13px] text-muted">
        Decisions your relationship manager submits will appear here with their full reasoning.
      </p>
    </div>
  );
}

/** An uppercase, tracked section header — the app's section-label convention. */
function SectionHeader({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-2.5 flex items-center text-[11px] font-semibold tracking-[0.12em] text-muted uppercase">
      {children}
    </h2>
  );
}

/**
 * The read-only decision drill-down — the full {@link VerdictCard} over a frosted backdrop.
 *
 * WHY NOT reuse the compliance {@link ../compliance/RecordModal}: that one re-fetches the record by id via
 * {@code GET /records/{id}}, which a customer is (correctly) 403'd from — and it does not need to, because
 * {@code /my/records} already delivered this record with its explanation prose stitched. So this modal takes
 * the record it is handed and only presents it; it copies RecordModal's frosted-glass chrome (backdrop blur,
 * scale-in, Escape / backdrop-click close, focus-to-close) rather than its fetch logic.
 *
 * VerdictCard is rendered with {@code audience="customer"} and WITHOUT {@code onReview} (a customer never
 * reviews): its approval block reads as a neutral "Bank review" — the recorded Approved/Rejected decision if
 * one exists, else an "under review" note — and its explanation is the unbranded plain-language block, with
 * no AI/provider/status wording. The {@code explanationWatchStopped}/{@code onStopWaiting} props are inert
 * for this audience (the customer view has no live "Generating…" state to stop) but remain part of the
 * card's required contract, so they are passed as {@code true} / {@link NOOP}.
 */
function RecordDetailModal({ record, onClose }: { record: DecisionRecord; onClose: () => void }) {
  const reduceMotion = useReducedMotion();
  const closeRef = useRef<HTMLButtonElement>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Frosted backdrop — blurs the portal behind (not a flat dim), so the app visibly pauses. */}
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
          <VerdictCard
            record={record}
            audience="customer"
            explanationWatchStopped={true}
            onStopWaiting={NOOP}
          />
        </div>
      </motion.aside>
    </div>
  );
}

/** No-op: VerdictCard requires an onStopWaiting handler, but the customer audience renders the unbranded
 *  plain-language block instead of the AI footer (the only caller of onStopWaiting), so it is never invoked here. */
function NOOP(): void {
  // intentionally empty — see the doc above.
}

/** Two-letter initials for the avatar (first + last token). */
function Initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}
