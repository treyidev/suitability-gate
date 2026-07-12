/**
 * The unauthenticated entry point — a split brand-panel + form card over the ledger-grid canvas.
 *
 * DESIGN (D17): the left panel is the product's opening statement to a judge — wordmark, the thesis
 * line ("Guarantees in code, judgment in the model"), three proof points, and the mandatory
 * data-source badge — set on the brand teal with the single orange rule this screen spends its accent
 * on. The right panel is the working form: modern fields (leading icons, password eye toggle) and
 * one-click demo-identity chips instead of a plain-text credentials hint.
 *
 * MOTION: one orchestrated entrance (card rises, contents stagger) plus micro-states on the button
 * and error — deliberately nothing ambient. `useReducedMotion` collapses all offsets to zero.
 *
 * On success the auth context flips and {@link ../App} renders the role-appropriate face; on failure
 * the gateway's RFC-7807 message is shown inline.
 */
import { useRef, useState } from "react";
import type { SubmitEvent } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

import { ApiError } from "../api/client";
import { useAuth } from "../auth/useAuth";
import { GlowButton } from "../components/GlowButton";
import { CheckCircleIcon, LockIcon, UserIcon } from "../components/icons";
import { TextField } from "../components/TextField";
import { springSnappy } from "../motion";

/** Entrance easing — one curve shared by every element so the sequence reads as a single gesture. */
const EASE = [0.22, 1, 0.36, 1] as const;

/**
 * Minimum time Sign in stays "busy" (owner-directed 2026-07-11, superseding the earlier "login blink"
 * note) so the working-border glow is visible on a sub-second login. The commit is gated on this in the
 * auth provider (the screen unmounts the moment the session commits). Presentation staging only — a
 * failed login never waits this out.
 */
const MIN_LOGIN_BUSY_MS = 1000;

/**
 * How long the sign-in request must run before the Cancel affordance appears (§5b progressive
 * disclosure). Set above {@link MIN_LOGIN_BUSY_MS} so the presentation hold alone never trips it —
 * Cancel only surfaces on a genuinely hung request.
 */
const CANCEL_DISCLOSURE_MS = 2000;

/** The three demo identities, surfaced as one-click prefill chips (customer.demo = the transparency portal). */
const DEMO_IDENTITIES = [
  { username: "rm.demo", roleLabel: "Relationship Manager" },
  { username: "supervisor.demo", roleLabel: "Compliance" },
  { username: "customer.demo", roleLabel: "Customer" },
] as const;

/** What the product proves before anyone signs in — the brand panel's three rows. */
const PROOF_POINTS = [
  "Deterministic verdicts in milliseconds",
  "Every decision sealed into an audit ledger",
  "AI explains — it never decides",
] as const;

/** Full-screen login: brand panel + form card. */
export function LoginScreen() {
  const { login } = useAuth();
  const reduceMotion = useReducedMotion();
  const [username, setUsername] = useState("rm.demo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setSubmitting(true);
    setShowCancel(false);
    // Progressive-disclosure cancel: only reveal after ~2s of real latency (§5b).
    const cancelTimer = window.setTimeout(() => setShowCancel(true), CANCEL_DISCLOSURE_MS);
    try {
      await login(username, password, controller.signal, MIN_LOGIN_BUSY_MS);
      // On success this component unmounts (App re-renders the authenticated face); no reset needed.
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // Quiet revert (§5b): the user stopped waiting; not an error.
      } else {
        // Surface the gateway's message; fall back to a generic line for network/unknown failures.
        setError(err instanceof ApiError ? err.message : "Could not reach the server. Is it running?");
      }
      setSubmitting(false);
      setShowCancel(false);
      abortRef.current = null;
    } finally {
      window.clearTimeout(cancelTimer);
    }
  }

  /** Abort the in-flight sign-in fetch (only reachable via the >2s progressive-disclosure affordance). */
  function cancelLogin(): void {
    abortRef.current?.abort();
  }

  /** Prefill a demo identity so a judge signs in with two clicks. */
  function applyDemoIdentity(demoUsername: string): void {
    setUsername(demoUsername);
    setPassword("password");
    setError(null);
  }

  const rise = reduceMotion ? 0 : 12;
  const item = {
    hidden: { opacity: 0, y: rise },
    show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE } },
  };

  return (
    <div className="grid min-h-svh place-items-center bg-ledger-grid px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: reduceMotion ? 0 : 18, scale: reduceMotion ? 1 : 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: EASE, when: "beforeChildren", staggerChildren: 0.07 }}
        className="glass grid w-full max-w-4xl overflow-hidden rounded-2xl lg:grid-cols-[1.05fr_1fr]"
      >
        {/* ── Brand panel ─────────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-linear-to-br from-primary via-primary-dark to-primary-deep p-8 sm:p-10">
          {/* Oversized serif monogram watermark; decorative only. */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-4 -bottom-14 font-serif text-[11rem] leading-none font-medium text-white/5 select-none"
          >
            SG
          </span>

          <div className="relative flex h-full flex-col">
            <motion.div variants={item} className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/12 font-semibold text-white ring-1 ring-white/25">
                SG
              </div>
              <span className="text-xl tracking-tight text-white">
                <span className="font-semibold">Suitability</span>
                <span className="font-light">Gate</span>
              </span>
            </motion.div>

            <div className="mt-10 mb-10 lg:mt-14 lg:mb-0">
              <motion.p
                variants={item}
                className="text-[11px] font-medium tracking-[0.18em] text-white/60 uppercase"
              >
                Pre-transaction compliance
              </motion.p>
              {/* The one place this screen spends its orange. */}
              <motion.div variants={item} className="mt-3 h-1 w-10 rounded-full bg-accent" />
              <motion.h1
                variants={item}
                className="mt-4 max-w-xs font-serif text-2xl leading-snug font-medium text-white sm:text-[28px]"
              >
                Guarantees in code, judgment in the model.
              </motion.h1>

              <motion.ul variants={item} className="mt-8 hidden space-y-3 lg:block">
                {PROOF_POINTS.map((point) => (
                  <li key={point} className="flex items-center gap-2.5 text-sm text-white/85">
                    <CheckCircleIcon className="h-4.5 w-4.5 shrink-0 text-white/70" />
                    {point}
                  </li>
                ))}
              </motion.ul>
            </div>

            <motion.div variants={item} className="mt-auto">
              <span className="inline-flex items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white/85 ring-1 ring-white/20">
                Data source: SYNTHETIC · IDBI adapter: ready
              </span>
            </motion.div>
          </div>
        </div>

        {/* ── Form panel ──────────────────────────────────────────────────────────── */}
        <div className="flex flex-col justify-center p-8 sm:p-10">
          <motion.div variants={item}>
            <h2 className="text-xl font-semibold text-ink">Sign in</h2>
            <p className="mt-1 text-sm text-muted">Use a demo identity to explore the gate.</p>
          </motion.div>

          <motion.form variants={item} onSubmit={handleSubmit} className="mt-6 space-y-4">
            <TextField
              id="username"
              label="Username"
              type="text"
              value={username}
              onChange={setUsername}
              autoComplete="username"
              placeholder="rm.demo"
              autoFocus
              icon={<UserIcon className="h-4.5 w-4.5" />}
            />
            <TextField
              id="password"
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
              placeholder="••••••••"
              icon={<LockIcon className="h-4.5 w-4.5" />}
            />

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-lg border border-danger/40 bg-danger-tint px-3.5 py-2.5 text-sm text-danger-bright"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* The one shared primary button (owner-directed) — same gradient + working-border language
                as the workbench's Evaluate. type="submit" so the form's onSubmit drives it. */}
            <GlowButton type="submit" label="Sign in" busyLabel="Signing in…" busy={submitting} />

            {/* Progressive disclosure: only appears after ~2s of real latency. Copy never implies the
                sign-in was undone — it stops the client waiting, nothing more. */}
            {showCancel && (
              <button
                type="button"
                onClick={cancelLogin}
                className="w-full text-center text-[12px] font-medium text-muted underline-offset-2 transition-colors hover:text-ink hover:underline"
              >
                Taking longer than usual — stop waiting for the response
              </button>
            )}
          </motion.form>

          <motion.div variants={item} className="mt-7">
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="text-[11px] font-medium tracking-wide text-muted uppercase">
                Demo identities
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              {DEMO_IDENTITIES.map((identity) => (
                <motion.button
                  key={identity.username}
                  type="button"
                  onClick={() => applyDemoIdentity(identity.username)}
                  whileHover={reduceMotion ? undefined : { scale: 1.02 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                  transition={springSnappy}
                  className="rounded-lg border border-line bg-canvas px-3 py-2.5 text-left transition-colors hover:border-primary-bright/40 hover:bg-primary-tint/60 focus-visible:ring-3 focus-visible:ring-primary-bright/30 focus-visible:outline-none"
                >
                  <span className="block font-mono text-[13px] font-medium text-ink">
                    {identity.username}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-muted">{identity.roleLabel}</span>
                </motion.button>
              ))}
            </div>

            <p className="mt-6 flex items-center justify-center gap-1.5 text-[11px] text-muted">
              <LockIcon className="h-3.5 w-3.5" />
              Stateless session · signed JWT · demo credentials only
            </p>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
