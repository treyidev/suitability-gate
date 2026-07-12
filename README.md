<div align="center">

# SuitabilityGate

**The pre-transaction suitability gate for bank-distributed mutual funds.**

*Every sale checked before it happens. Every decision recorded forever. Every record defensible to a regulator.*

`Java 21` · `Spring Boot 3 / Spring Modulith` · `FastAPI` · `React 19` · `LLM-ready (provider-swappable)`

[Demo](#-90-second-demo) · [Quickstart](#-quickstart) · [Architecture](#-architecture) · [Why the AI can't get this wrong](#-guarantees-in-code-judgment-in-the-model) · [Roadmap](#-status--roadmap)

**Status: Phase-1 vertical slice — live end-to-end today.** 4 deterministic rules · 3 role-gated faces · one `docker compose up` · [what's next ↓](#-at-a-glance)

<!-- HERO: docs/assets/demo.gif — the Mrs. Sharma FLAG moment (see docs/assets/README.md for the capture manifest) -->

</div>

---

## The problem this solves

The obvious wealth-tech product is an AI advisor. For a bank that distributes mutual funds, it is also the wrong one.

Here's the catch: **in India, distributing a mutual fund and advising on one are two different regulatory licences.** Under SEBI's Investment Advisers Regulations, a mutual-fund *distributor* can distribute but cannot *advise* — and may not even hold itself out as a "wealth adviser." For a bank that distributes funds, an AI advisor — however brilliant — is a product it is not licensed to deploy.

What a distributor *is* expected to operate is strong **suitability control**: every sale weighed against the customer's profile, with a defensible record standing behind it. This is a responsibility distributors already own — and it is exactly where SEBI's surveillance looks, for the profile-vs-scheme mismatches these controls exist to catch (the canonical pattern being high-risk small-cap funds sold to investors in their 70s), with the ARN itself on the line if a gap is ever found.

**And the ground is shifting under this control right now.** India's mutual fund industry crossed ₹60 lakh crore in assets in 2025, and SEBI has replaced its 1996 framework wholesale with the [SEBI (Mutual Funds) Regulations, 2026](https://www.sebi.gov.in/legal/regulations/jan-2026/securities-and-exchange-board-of-india-mutual-funds-regulations-2026_99173.html) — a regime in which suitability assessment and risk profiling move from good practice to explicit expectation, and where enforcement has repeatedly turned on transactions carried out **without a proper suitability record**. For a distributor, the economics are not subtle: a control like this costs a fraction, per decision, of what a single mis-selling finding costs the ARN that let it through.

SuitabilityGate is built to make that control **real-time, consistent, and audit-ready**: it runs the suitability check at the point of sale, every time, and leaves a permanent, append-only record behind every decision. It does not replace a distributor's compliance function — it hands that function a system of record produced by a rule engine at the moment of the sale, rather than assembled by hand after the fact.

## What SuitabilityGate is

A checkpoint between the relationship manager and the transaction.

**Every proposed mutual fund sale passes through the gate before it proceeds.** The gate:

1. **Checks** the customer–product match against codified suitability rules — the same patterns SEBI's surveillance flags (age × scheme risk, stated risk × riskometer, horizon × lock-in, senior-citizen composites — and, in Phase 2, concentration and stated-vs-revealed risk contradictions).
2. **Records** the complete decision in an append-only ledger: who, what, every rule that ran, its inputs, the threshold applied, the verdict, and the supervisor's mandatory approve/reject decision — who and why, appended forever.
3. **Reports** it three ways from one record: an instant verdict for the RM, a plain-language transparency view for the customer, and a compliance dashboard + queryable ledger for the compliance office.

> **The pitch in one line:** SEBI's surveillance weighs these transactions from the outside, after they happen. SuitabilityGate lets the distributor apply the same scrutiny from the inside, at the point of sale — turning a control it already owns into something automatic, consistent, and on the record.

Two boundaries define the product. Against advisory products: **it never advises — it only gates**, which is precisely what a distributor is allowed (and now effectively required) to operate. Against the risk-profiling tools the market already has: those stop at *who the investor is*, assessed at onboarding — SuitabilityGate operates at the **transaction**, where mis-selling actually happens: it decides, records, and can prove every individual sale.

## ⚡ At a glance

| Live today (this tag) | Final prototype — July 31 | Beyond |
|---|---|---|
| 4 suitability rules · deterministic verdicts in milliseconds | Full 8-rule catalogue | **Opportunity radar & RM success coaching** — the revenue side |
| Append-only decision ledger · human-readable certificate numbers | Regulation citations on every rule (SEBI/AMFI clause → screen) | Supervision analytics — RM/branch outlier surfacing |
| RM Prospects co-pilot + Evaluate workbench | Rule-*engine* swap proven by config (Easy Rules) | Regulator inspection pack |
| Mandatory supervisor approval on **every** decision | Live **local** model behind every AI seam | Live bank adapters |
| Customer transparency portal | Vernacular customer explanations | Per-branch rulesets · access-audit |
| Compliance dashboard + Ledger Copilot (deterministic NL queries) | *Stretch:* commission disclosure · churn rule · hash-chained ledger | |

Everything in column one runs now — `docker compose up`, three logins, no keys, no cloud. Details and honest caveats: [Status & roadmap](#-status--roadmap).

## 🎬 90-second demo

**Screenshot-by-screenshot walkthrough:** [docs/WALKTHROUGH.md](docs/WALKTHROUGH.md) — the same decision below, followed step by step against a real running instance. (A recorded video is a Phase-2 deliverable — this doc is the Phase-1 walkthrough.)

1. An RM lands on the **Prospects co-pilot** — a deterministic worklist of customers, each paired with a fund that *already clears the gate* for them. **Mrs. Sharma, 72, risk profile: Conservative** appears as an existing client; the RM picks her and the workbench opens pre-filled with the compliant suggestion — a distribution-side pre-filter, rules-aware, never advice.
2. The RM instead proposes a small-cap (Very High risk) fund and hits **preview** → **FLAGGED** in milliseconds, with three plain-English reasons: age × risk band, stated risk mismatch, senior-citizen enhanced check.
3. The RM submits the decision to a supervisor. A **human supervisor** must approve or reject *every* decision — PASS or FLAGGED — and the choice is appended to the record forever. Humans stay in the loop.
4. The decision is already in the ledger under a human-readable certificate number (`SG-2026-NNNNNN`), and a plain-language explanation is attached a beat later — written by a service that had *no part* in the decision.
5. The **customer** logs into their own transparency portal and sees exactly why a decision landed the way it did. The **compliance officer** sees the whole ledger as a dashboard, and can query it in plain English ("show me every flagged small-cap sale to a senior this month").

*The point is defensibility: if a sale is ever questioned — by SEBI, a fund house, or the bank's own compliance — the answer is a record that already exists, capturing every rule, input, threshold, and human sign-off at the moment of decision rather than reconstructed after the fact.*

## 🔒 Guarantees in code, judgment in the model

The single most important design decision in this system:

**No model can produce a verdict, a number, or a product judgment. Architecturally.**

```
[1] Resolve customer  ──►  deterministic
[2] Resolve scheme    ──►  deterministic
[3] Evaluate rules    ──►  deterministic   ← the decision happens HERE
[4] Record decision   ──►  frozen, append-only ledger
[5] Explain (async)   ──►  the ONLY model touchpoint — strictly downstream of a frozen record
```

The rules engine decides. The record freezes. *Then* the frozen record is handed to a **physically separate service** (FastAPI/Python) to be rendered in plain language — a service that receives the record read-only, owns no data, and cannot call back into the decision path. If that service is down, throttled, or wrong, the gate still gates: verdicts render without prose.

**Where the AI is today, honestly:** Phase 1 ships with **no live LLM anywhere**. The explanation service is a deterministic canned-text stub (`stub-canned-v1`) that proves the seam — the event → async → provider boundary is real and exercised, but the "model" is a fragment assembler. Every other surface that *looks* AI-assisted — the RM co-pilot's suitable-product shortlist, the compliance Ledger Copilot's natural-language queries — is **fully deterministic today**, computed from rules and record data, never from a model. This is a deliberate choice, not a gap: it lets a bank see the accessibility of AI with the auditability of code, and it means a regulator can re-run the same inputs and get the same verdict, every time.

**The seam is built so the model drops in without touching the decision path.** The provider sits behind a single interface (`ExplanationProvider`); the co-pilot behind `PlanProposer`; the ledger query behind a typed filter. Phase 2 wires a real model (**local-model-preferred**, provider-swappable) behind each — one class, one config value, zero pipeline impact, and the verdict is *still* never AI-made. **AI proposes; code decides.**

## 🏗 Architecture

<!-- docs/assets/architecture.svg (authored diagram — see docs/assets/README.md) -->

**Service-shaped boundaries, pragmatically deployed.** The system is decomposed into seven components with strict ownership; for the prototype they run as three processes (Java Modulith core · Python explanation service · React frontend), one `docker compose up`.

| Component | Responsibility | Owns data? |
|---|---|---|
| **Suitability** | Rules engine + evaluation pipeline. Stateless, pure computation. | No |
| **Customer Data** | Canonical profiles & holdings behind ports/adapters. Capability flags. | No (adapter-backed) |
| **Scheme Catalog** | Canonical scheme data behind ports/adapters. | No (adapter-backed) |
| **Decision Record** | Append-only ledger. The system of record. Sole writer: Suitability. | **Yes — the only one** |
| **Explanation** *(Python)* | The model in its box. Frozen record in, prose out. | No |
| **Reporting** | Dashboard + ledger projections. | No (reads ledger) |
| **Gateway** | JWT validation, role gating, routing. No business logic. | No |

Four properties worth calling out:

**1. Module boundaries are compile-time enforced, not diagrammed.** Spring Modulith's `ApplicationModules.verify()` fails the build if any module reaches across a boundary. The architecture isn't a promise in a slide — it's a property of the build.

**2. "Synthetic now, live bank systems later" is a wiring change.** Every data source sits behind a port with a canonical model the engine owns. The synthetic adapters translate a deliberately *messy* bank-export-shaped schema (stale KYC dates, missing incomes, cryptic scheme codes) — the same translation work a real bank adapter does. Connecting a bank's actual systems means writing one adapter class per source and touching nothing else. Sources advertise capabilities; rules that need unavailable data degrade gracefully and are recorded as SKIPPED — auditable even in what *couldn't* be checked.

**3. One record, many renderings.** The pipeline's shared context object *is* the DecisionRecord — the audit trail is a byproduct of coordination, not a bolted-on log. RM verdict, customer transparency view, and compliance dashboard are projections of that single record. They cannot disagree.

**4. The rules *engine itself* is swappable — not just the rules.** The pipeline depends only on a `SuitabilityEvaluator` interface; the native engine that runs the rule beans is one implementation, chosen by a single config value (`suitabilitygate.engine`). A **third-party rule engine registers as another implementation** and is selected without touching a line of the pipeline. Whatever runs, the guarantee is unchanged: the verdict is produced by deterministic code, is replayable, and is never influenced by an LLM. *(Phase 2 exercises this seam end-to-end — see the roadmap.)*

## ⚖️ The rules

Suitability rules mirror the patterns SEBI's own surveillance flags. Each is one small class implementing one interface, discovered by injection — **adding a rule is dropping in a class.** Thresholds live in a versioned ruleset config (`ruleset-2026.07.1.yaml`): compliance tunes limits without a deployment, and every DecisionRecord is stamped with the ruleset version that evaluated it.

**Live in Phase 1 (4 rules, wired against the real pipeline):**

| Rule | Catches |
|---|---|
| `AGE_RISK_BAND` | Scheme risk above the cap for the customer's age bracket *(the SEBI headline: 70+ sold small-cap)* |
| `STATED_RISK_MATCH` | Scheme riskometer above the customer's stated risk category |
| `SENIOR_ENHANCED` | Stricter composite for 60+ customers |
| `HORIZON_LOCKIN` | Lock-in longer than the customer's investment horizon |

**Phase 2 (interface-identical, drop-in — thresholds already reserved in the ruleset):**

| Rule | Catches |
|---|---|
| `CONCENTRATION` | Over-exposure to high-volatility assets after this purchase |
| `INCOME_PROPORTIONALITY` | Investment outsized vs. declared income |
| `KYC_FRESHNESS` | Stale risk profile / unverified KYC |
| `STATED_VS_REVEALED` | Stated "conservative" **contradicted by** actual risky holdings — surfaced to the human, not auto-decided |

Verdict composition is deliberately explainable in one sentence: *any FLAG-severity failure flags the transaction; warnings annotate without blocking.* A FLAG is not a hard block — a supervisor can override with mandatory justification, and the override is appended to the ledger with the supervisor's identity. Real compliance is "flag and justify," not "computer says no."

## 🧭 The three faces

One role-gated app, one API, three disjoint experiences:

- **Relationship Manager** — two working surfaces. A **Prospects co-pilot** (the landing screen): a deterministic, searchable worklist of customers, each paired with a fund that *already clears the gate* for them and with established clients visibly flagged — click one and the workbench opens pre-filled; submit a decision and that customer drops off the list. Then the **Evaluate workbench**: **suggest** (co-pilot shortlists gate-clearing funds) → **preview** (a non-persisted verdict check before committing) → **submit** (freezes the DecisionRecord and routes it to a supervisor). *Both co-pilot surfaces are deterministic and rules-aware today; model-driven shortlisting is Phase 2.*
- **Compliance officer** — a **live dashboard** (verdict KPIs, rule-breakdown, the whole-ledger records table) plus **Ledger Copilot**, a natural-language query surface over the decision ledger. *Ledger Copilot parses queries deterministically today against a curated vocabulary and answers from real counts only — never fabricates a number. LLM-backed querying is Phase 2.* (Two dashboard widgets — a branch × week heatmap and a weekly trend — are honestly labelled Phase-2 placeholders in the UI.)
- **Customer** — a read-only **transparency portal**: their own profile and their own decisions, scoped strictly to their token. They see exactly why each decision landed as it did — self-service access to one's own data, in the spirit of the data-principal rights India's DPDP Act codifies.

## 🚀 Quickstart

**One command, all three services (Docker):**

```bash
git clone https://github.com/treyidev/suitability-gate.git
cd suitability-gate
docker compose up -d --build
```

This builds and starts the Java core, the Python explanation service, and the React frontend, H2-backed and seeded with a demo ledger. (Postgres is opt-in: `COMPOSE_PROFILES=postgres docker compose up -d --build`.)

| | |
|---|---|
| RM Workbench | http://localhost:5173 — login `rm.demo` / `password` |
| Compliance dashboard + Ledger Copilot | login `supervisor.demo` / `password` |
| Customer transparency portal | login `customer.demo` / `password` |
| API | http://localhost:8080 |
| Explanation service | http://localhost:11111 |

Try it: log in as `rm.demo`, pick **Mrs. Sharma**, propose the **small-cap fund**, hit preview. Watch it flag — and note the evaluation time on the verdict.

> **No secrets required for the demo.** The JWT signing secret ships with a dev-only default; override it (and any other setting) via environment — see `.env.example`. No cloud, no external network, no API keys.

**Local dev (no Docker):**

```bash
./scripts/launch.sh          # explanation-service (uv) + core (mvnw, H2) + frontend (vite), in order
./scripts/launch.sh --stop   # tears all three down by port
```

## 📊 Performance is a compliance feature

The gate sits **inside the sales flow** — so it must never slow a legitimate sale.

- Verdict latency = rules-engine latency, measured in **milliseconds** — no model sits on the critical path by design.
- Every verdict displays its own evaluation time, and every DecisionRecord embeds `evaluationDurationMs` in its provenance — the check reports exactly how long it took, per decision, rather than asking you to take the number on faith.
- Stateless evaluation core: horizontal scaling is a replica count, not a redesign.

## 🔐 Security posture (prototype-calibrated, honestly labelled)

Implemented: JWT on every request; role-gated authorization defended in depth (URL rules **and** method-level `@PreAuthorize`); RMs evaluate, only compliance reaches the ledger and overrides, customers see only their own records; **identity flows from the verified token into the audit record and the customer's data scope** — never trusted from the request body; secrets via environment; the Python explanation service receives only frozen, PII-free decision data (ids and rule outcomes — never names, incomes, or dates of birth) and cannot call back into the decision path; request validation at every boundary.

Deliberately deferred for prototype scope, listed so the omissions are decisions rather than oversights: bank SSO/IdP integration, asymmetric keys/JWKS, refresh rotation, mTLS between services, secrets manager, access-audit (login events) alongside decision-audit.

## 🗺 Status & roadmap

**Phase 1 — current release (this tag):** the vertical slice, end to end.

- Four core rules · the deterministic evaluation pipeline · the append-only ledger with human-readable certificate numbers.
- **RM Prospects co-pilot** — the RM's landing screen: a deterministic, searchable worklist of customers with gate-clearing suggested plans (established clients flagged), each pre-filling the workbench in one click.
- **RM workbench** — co-pilot suggest (deterministic, rules-aware) → preview → submit.
- **Mandatory supervisor approval** on *every* decision (PASS or FLAGGED) — human-in-the-loop, appended to the ledger.
- **Customer transparency portal** — the investor's own decisions, self-service.
- **Compliance dashboard** + **Ledger Copilot** natural-language ledger queries (deterministic).
- JWT/roles defense-in-depth · `docker compose up` for all three services · golden demo scenarios verified against the real pipeline.

**Phase 2 — final prototype (July 31):**

- **The full rule catalogue** — the remaining four rules drop in behind the identical interface.
- **Regulation traceability** — every rule carries the regulatory basis it operationalizes (SEBI suitability norms, AMFI circular clauses), stamped from the versioned ruleset through the DecisionRecord to the rule row on screen. The catalogue reads as encoded regulation, not house policy.
- **Third-party rule engine, proven by a config swap** — the four rules re-expressed for a lightweight open-source engine (**Easy Rules**, MIT) behind the existing `SuitabilityEvaluator` seam, selected by one config value (`suitabilitygate.engine=easyrules`). Golden scenarios 1 / 2 / 4 run green under *both* the native engine and Easy Rules — demonstrating the engine is swappable without touching the pipeline, and that the verdict stays deterministic and replayable regardless of which engine produced it.
- **Live model behind every AI seam** — the explanation service, the RM co-pilot's shortlisting, and Ledger Copilot's query understanding each get a real model (local-model-preferred, provider-swappable). The deterministic gate remains the sole authority on suitability: **AI proposes, code decides** — never AI-decides.
- **Vernacular customer explanations** — the explanation seam renders the customer's plain-language view in Indian languages. The provider boundary already keeps prose entirely outside the decision path, so this is a provider change, not a pipeline change.
- Compliance dashboard branch heatmap & weekly-trend drill-down (the two placeholders are already stubbed in the UI) · exportable PDF/JSON certificates · load demonstration · seeded multi-day decision history · hosted documentation site.

**Phase 2 stretch** — declared honestly as schedule-permitting, in priority order:

1. **Commission disclosure at decision time** — the distributor's commission on the proposed scheme, recorded in the DecisionRecord and disclosed in the customer's transparency view. Mis-selling's root incentive, put on the record — the same disclosure direction SEBI's 2026 cost-transparency overhaul pushes.
2. **`CHURN_DETECTION` rule** — rapid switch / redeem-and-repurchase patterns over the customer's own decision history; SEBI's anti-churning concern as one more drop-in rule behind the same interface.
3. **Hash-chained decision records** — each record seals a cryptographic hash of its predecessor, upgrading the ledger from append-only-by-discipline to **tamper-evident-by-construction**: any edit, anywhere in history, breaks the chain visibly.

> **On the co-pilot and "the bank never advises":** the co-pilot — the Prospects worklist and the in-form suggest alike — only ever surfaces products that *pass the bank's own suitability gate* — it filters the distributable catalogue to what is compliant to even propose, which the RM (a human) then proposes and a supervisor approves. The gate decides; the co-pilot never recommends a product to a customer. In Phase 2 a model does the shortlisting, but the deterministic gate remains the sole authority on suitability.

**Beyond the prototype** (extension points already in the architecture):

- **Opportunity radar & RM success coaching** — the revenue side of the gate. Consent-gated enrichment from credit-bureau data and the bank's own relationship history (salary patterns, maturing deposits, idle balances, products already held) surfaces cross-sell prospects among the bank's existing customers, and a success-predictor scale coaches the RM on where a conversation is most likely to land — with explained reasons, not a bare score. The guarantee that makes this safe to want: **suitability decides first; propensity only ranks the gate-passing set; and the score never enters the compliance record.** Where generic next-best-action engines optimize conversion and *create* mis-selling risk, this one provably cannot propose an unsuitable product — AI proposes, code decides, here too.
- Live bank adapters against sandbox APIs · behavioral risk inference from transaction history (the groundwork for `STATED_VS_REVEALED`) · **supervision analytics** — RM- and branch-level outlier surfacing (flag rates, override rates) on the compliance dashboard · **regulator inspection pack** — one-click export of any period's decisions with their certificate chain · Modulith event externalization for downstream consumers · per-branch ruleset variants · access-audit.

## 🧭 Repository map

```
suitability-gate/
├── core/                      # Java 21 · Spring Boot · Spring Modulith
│   └── src/main/java/…/
│       ├── suitability/       # rules engine + pipeline (stateless)
│       ├── customerdata/      # ports/adapters — canonical profiles & holdings
│       ├── schemecatalog/     # ports/adapters — canonical schemes
│       ├── decisionrecord/    # append-only ledger (owns the DB)
│       ├── explanation/       # the async explanation seam (provider-swappable)
│       ├── reporting/         # ledger projections
│       ├── gateway/           # JWT · roles · routing
│       └── shared/            # canonical models (open kernel)
├── explanation-service/       # Python · FastAPI — the model in its box (canned stub in Phase 1)
├── frontend/                  # React 19 · TypeScript · Vite · Tailwind
├── ruleset/                   # versioned suitability thresholds (YAML)
├── scripts/                   # local dev launch/teardown
├── contracts/                 # reserved: OpenAPI + DecisionRecord schema (not yet populated)
├── .env.example               # every overridable setting, with dev defaults
└── docker-compose.yml
```

Verification stance for the prototype, stated plainly: full test suites are deferred by decision; what *is* verified is what protects correctness where it counts — compile-time module boundaries (`ApplicationModules.verify()`) and golden demo scenarios exercised against the real pipeline.

---

<div align="center">

**Built by [Treyi](https://github.com/treyidev)** — a proof of concept for pre-transaction suitability control in bank-distributed mutual funds.

*The gate never advises. It protects — the customer from unsuitable products, the RM with a check at the point of sale, and the bank's compliance function with a record it can stand behind.*

</div>
