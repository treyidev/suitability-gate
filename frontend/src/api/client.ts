/**
 * The single seam between the React app and the Java gateway.
 *
 * Why a thin module of functions (not a class): there is no client-side state or lifecycle to hold —
 * the base URL is a build-time constant and the bearer token is passed in per call — so free functions
 * are the plainest shape that does the job (see the debuggability rule in CLAUDE.md). Every network
 * call in the app goes through {@link request}, which centralises error translation: the backend speaks
 * RFC-7807 `application/problem+json`, so a failed call throws an {@link ApiError} carrying the server's
 * `detail` and HTTP status rather than leaking a raw `Response`.
 *
 * WHERE IT FITS: screens/hooks call the exported functions; the base URL points at the gateway
 * (`gateway` module), which is the only backend surface the frontend is allowed to touch (brief §3.1).
 */
import type {
  CustomerProfile,
  DecisionRecord,
  EvaluationPreview,
  EvaluationRequest,
  LoginResponse,
  OverrideEvent,
  OverrideStatus,
  PlanSuggestionResponse,
  Prospect,
  Scheme,
} from "./types";

/** Gateway base URL — from Vite env at build time, defaulting to the local dev backend. */
const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

/**
 * A non-2xx response from the gateway. Carries the HTTP status and the human-readable `detail` from
 * the RFC-7807 problem body when present, so callers can show a real message and branch on `status`
 * (e.g. 401 → back to login).
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Options for an authenticated request. */
interface RequestOptions {
  readonly method?: "GET" | "POST";
  readonly body?: unknown;
  /** Bearer token; omitted for the public login call. */
  readonly token?: string;
  /**
   * Optional abort signal (directive §5b honest cancel). When the caller aborts, `fetch` rejects with
   * a `DOMException` named `AbortError`, which propagates out unchanged — callers treat it as a quiet
   * revert (the request stopped *waiting*; any server-side effect is not undone), never as an error.
   */
  readonly signal?: AbortSignal;
}

/**
 * Issue a request to the gateway and parse the JSON response, failing fast on any non-2xx status.
 *
 * Side effect: performs a network call. On a non-2xx response it reads the problem+json body (if any)
 * and throws {@link ApiError}; it never returns a partial or null result on failure.
 *
 * @param path absolute gateway path beginning with `/` (e.g. `/auth/login`)
 * @param options method, body, and optional bearer token
 * @returns the parsed response body as `T`
 * @throws ApiError on a non-2xx response (message = server `detail` when available)
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw new ApiError(response.status, await extractProblemDetail(response));
  }
  return (await response.json()) as T;
}

/**
 * Pull the best available error message off a failed response: the RFC-7807 `detail` field when the
 * body is problem+json, otherwise a generic status line. Never throws — error handling must not itself
 * fail and mask the original error.
 */
async function extractProblemDetail(response: Response): Promise<string> {
  try {
    const problem = (await response.json()) as { detail?: string; title?: string };
    return problem.detail ?? problem.title ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

/**
 * Authenticate against the gateway and obtain a JWT.
 *
 * @param username demo login (e.g. `rm.demo`)
 * @param password demo password
 * @param signal optional abort signal (login's >2s progressive-disclosure cancel, §5b)
 * @returns the token and granted role
 * @throws ApiError with status 401 on bad credentials; `AbortError` if the caller aborts
 */
export function login(
  username: string,
  password: string,
  signal?: AbortSignal,
): Promise<LoginResponse> {
  return request<LoginResponse>("/auth/login", {
    method: "POST",
    body: { username, password },
    signal,
  });
}

/**
 * List all customers for the RM's picker ({@code GET /customers}).
 *
 * @param token bearer token
 * @returns every known customer profile
 */
export function fetchCustomers(token: string): Promise<CustomerProfile[]> {
  return request<CustomerProfile[]>("/customers", { token });
}

/**
 * List all schemes for the RM's picker ({@code GET /schemes}).
 *
 * @param token bearer token
 * @returns every known scheme
 */
export function fetchSchemes(token: string): Promise<Scheme[]> {
  return request<Scheme[]>("/schemes", { token });
}

/**
 * Evaluate a proposed transaction ({@code POST /evaluations}) and return the frozen decision record.
 * The RM identity is taken from the token server-side, so it is not part of the request.
 *
 * @param token bearer token
 * @param proposal customer, scheme, amount, and transaction type
 * @param signal optional abort signal (Evaluate's >2s progressive-disclosure cancel, §5b)
 * @returns the full decision record (verdict, rule results, provenance)
 * @throws ApiError on 400 (e.g. amount below the scheme minimum) or 404 (unknown customer/scheme);
 *   `AbortError` if the caller aborts (the decision may already be recorded server-side — an audit
 *   bell cannot be un-rung; aborting stops the client *waiting*, it does not undo the evaluation)
 */
export function evaluate(
  token: string,
  proposal: EvaluationRequest,
  signal?: AbortSignal,
): Promise<DecisionRecord> {
  return request<DecisionRecord>("/evaluations", { method: "POST", body: proposal, token, signal });
}

/**
 * Preview a proposed transaction's verdict WITHOUT recording it ({@code POST /evaluations/preview}) —
 * the RM's Evaluate/check step. Runs the same deterministic rules as {@link evaluate} but persists
 * nothing (no certificate, no ledger write, no explanation); the RM reviews the outcome and then commits
 * it with {@link evaluate} (Submit). Determinism guarantees the preview verdict equals the committed one.
 * RM-only server-side (a supervisor gets 403); identity is taken from the token.
 *
 * @param token bearer token (a ROLE_RM session)
 * @param proposal customer, scheme, amount, and transaction type
 * @param signal optional abort signal (Evaluate's >2s progressive-disclosure cancel, §5b)
 * @returns the non-persisted verdict preview (verdict, reason, rule results)
 * @throws ApiError on 400 (e.g. amount below the scheme minimum), 403 (not RM), or 404 (unknown
 *   customer/scheme); `AbortError` if the caller aborts
 */
export function previewEvaluation(
  token: string,
  proposal: EvaluationRequest,
  signal?: AbortSignal,
): Promise<EvaluationPreview> {
  return request<EvaluationPreview>("/evaluations/preview", {
    method: "POST",
    body: proposal,
    token,
    signal,
  });
}

/**
 * Ask the RM co-pilot to suggest a suitable plan for a customer ({@code POST /suggestions}). The proposer
 * screens every scheme through the real gate and returns one that PASSES (with a rationale), or
 * {@code available: false} when none clears the gate. Advisory only — it persists nothing and produces no
 * verdict; the RM accepts/edits the plan and the gate adjudicates on Submit. RM-only server-side (a
 * supervisor gets 403); identity is taken from the token.
 *
 * @param token bearer token (a ROLE_RM session)
 * @param customerId the customer to propose a plan for
 * @param signal optional abort signal
 * @returns a suggested plan, or {@code available: false} when nothing passes
 * @throws ApiError on 403 (not RM) or 404 (unknown customer); `AbortError` if the caller aborts
 */
export function suggestPlan(
  token: string,
  customerId: string,
  signal?: AbortSignal,
): Promise<PlanSuggestionResponse> {
  return request<PlanSuggestionResponse>("/suggestions", {
    method: "POST",
    body: { customerId },
    token,
    signal,
  });
}

/**
 * Fetch the RM "Prospects" co-pilot worklist ({@code GET /prospects}) — every customer with a gate-passing
 * suggested plan, fresh (un-served) customers first, each carrying an "already served" flag. RM-only
 * server-side (a supervisor gets 403); identity is taken from the token. Advisory only — it persists nothing
 * and produces no verdict; the RM acts on a row through the normal Evaluate → Submit flow.
 *
 * @param token bearer token (a ROLE_RM session)
 * @param signal optional abort signal (the prospects hook aborts on reload/unmount to stay race-safe)
 * @returns the prospect rows (possibly empty), each a customer + suggested plan + "already served" flag
 * @throws ApiError with status 403 if the session is not ROLE_RM; `AbortError` if the caller aborts
 */
export function fetchProspects(token: string, signal?: AbortSignal): Promise<Prospect[]> {
  return request<Prospect[]>("/prospects", { token, signal });
}

/**
 * Read the whole decision ledger, newest first ({@code GET /records}) — the compliance dashboard's data
 * source. Server-side this endpoint is COMPLIANCE-only (an RM gets 403); it crosses every RM's records.
 *
 * <p><b>No explanation overlay (matches the backend {@code DecisionLedger.findAll}):</b> every record in
 * this list carries {@code aiContribution.explanationStatus === "PENDING"} regardless of the real async
 * outcome — the list intentionally skips the per-record explanation lookup. Consumers must NOT read
 * explanation state from this list; a single-record drill-down via {@link fetchRecord} carries the real
 * ATTACHED/FAILED prose.
 *
 * @param token bearer token (a ROLE_COMPLIANCE session)
 * @param signal optional abort signal (the dashboard hook aborts on reload/unmount to stay race-safe)
 * @returns every persisted decision, ordered newest first
 * @throws ApiError with status 403 if the session is not ROLE_COMPLIANCE; `AbortError` if the caller aborts
 */
export function fetchRecords(token: string, signal?: AbortSignal): Promise<DecisionRecord[]> {
  return request<DecisionRecord[]>("/records", { token, signal });
}

/**
 * Re-read a frozen decision record ({@code GET /records/{id}}).
 *
 * Used to poll for the async explanation: {@link evaluate} returns the record with
 * `aiContribution.explanationStatus === "PENDING"`, and this call re-fetches it until the downstream
 * explanation service has attached prose (ATTACHED) or failed (FAILED). An RM may only read their own
 * records (server-side `@PostAuthorize`); polling one's just-created record always satisfies that.
 *
 * @param token bearer token
 * @param recordId the record's UUID (`DecisionRecord.recordId`)
 * @param signal optional abort signal (the compliance drawer aborts on close / row-change to stay race-safe)
 * @returns the current state of the record, including any attached explanation
 * @throws ApiError on 404 (unknown id) or 403 (not the RM's own record); `AbortError` if the caller aborts
 */
export function fetchRecord(
  token: string,
  recordId: string,
  signal?: AbortSignal,
): Promise<DecisionRecord> {
  return request<DecisionRecord>(`/records/${recordId}`, { token, signal });
}

/**
 * Read the signed-in customer's OWN canonical profile ({@code GET /my/profile}) — the transparency
 * portal's "what the bank knows about me". CUSTOMER-only server-side (RM/supervisor get 403). The customer
 * is the one bound into the token; there is no id parameter to pass or tamper with.
 *
 * @param token bearer token (a ROLE_CUSTOMER session)
 * @param signal optional abort signal (the portal aborts on reload/unmount to stay race-safe)
 * @returns the caller's own profile (age, stated risk, horizon, KYC, income, assets)
 * @throws ApiError with status 403 if the session is not ROLE_CUSTOMER, 404 if no profile resolves;
 *   `AbortError` if the caller aborts
 */
export function fetchMyProfile(token: string, signal?: AbortSignal): Promise<CustomerProfile> {
  return request<CustomerProfile>("/my/profile", { token, signal });
}

/**
 * Read every suitability decision made in the signed-in customer's name ({@code GET /my/records}), newest
 * first — the transparency portal's decision history. CUSTOMER-only server-side (RM/supervisor get 403);
 * scoped to the token's customer, so it only ever returns that customer's own decisions.
 *
 * <p><b>Explanation overlay INCLUDED (unlike {@code fetchRecords}):</b> the backend stitches each record's
 * async explanation prose here, because that plain-language "why" is the point of the customer view and a
 * single customer's slice is small. So a record may carry `aiContribution.explanationStatus === "ATTACHED"`
 * with real prose — no per-record re-fetch needed. Supervisor-review overlays are stitched too, so each
 * decision's Pending/Approved/Rejected state is present.
 *
 * @param token bearer token (a ROLE_CUSTOMER session)
 * @param signal optional abort signal (the portal aborts on reload/unmount to stay race-safe)
 * @returns the customer's own decisions, newest first (possibly empty)
 * @throws ApiError with status 403 if the session is not ROLE_CUSTOMER; `AbortError` if the caller aborts
 */
export function fetchMyRecords(token: string, signal?: AbortSignal): Promise<DecisionRecord[]> {
  return request<DecisionRecord[]>("/my/records", { token, signal });
}

/**
 * Record a supervisor's review of a FLAGGED decision ({@code POST /evaluations/{id}/override}, brief §6.1)
 * — the human-in-the-loop step. COMPLIANCE-only server-side (an RM gets 403). The supervisor's identity is
 * taken from the token, so it is not part of the body.
 *
 * @param token         bearer token (a ROLE_COMPLIANCE session)
 * @param recordId      the FLAGGED record being reviewed
 * @param action        the review outcome — override the flag, or uphold it
 * @param justification the supervisor's mandatory, non-blank rationale
 * @returns the recorded {@link OverrideEvent}
 * @throws ApiError 403 (not compliance), 404 (unknown record), 400 (not FLAGGED / blank justification),
 *   409 (already reviewed)
 */
export function submitOverride(
  token: string,
  recordId: string,
  action: OverrideStatus,
  justification: string,
): Promise<OverrideEvent> {
  return request<OverrideEvent>(`/evaluations/${recordId}/override`, {
    method: "POST",
    body: { action, justification },
    token,
  });
}
