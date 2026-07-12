package com.treyi.suitabilitygate.suitability;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.treyi.suitabilitygate.customerdata.CustomerDirectory;
import com.treyi.suitabilitygate.customerdata.CustomerProfile;
import com.treyi.suitabilitygate.schemecatalog.Scheme;
import com.treyi.suitabilitygate.schemecatalog.SchemeCatalog;
import com.treyi.suitabilitygate.shared.RiskCategory;

/**
 * Phase-1 {@link PlanProposer} — a rules-aware, deterministic proposer honestly labelled "AI-assisted"
 * (a live model replaces it behind the {@link PlanProposer} seam in Phase 2, no upstream change).
 *
 * <p><b>How it stays true to the thesis:</b> it does not invent a verdict. It <em>screens</em> every
 * scheme in the catalogue through the very same deterministic gate the supervisor sees ({@link
 * EvaluationPipeline#screen} — stages 1–3, nothing persisted), keeps only the schemes that PASS, and
 * picks the best fit among them. So the suggestion is grounded in what actually clears the gate — the
 * co-pilot cannot suggest a product its own compliance gate would flag. If nothing passes, it returns
 * an honest empty.
 *
 * <p><b>Best-fit heuristic (explicit and swappable):</b> among the passing schemes, prefer the highest
 * riskometer level that still passes — matching the product to the client's risk <em>capacity</em> so no
 * suitable growth is left on the table — then fewer WARN annotations, then the lower minimum investment,
 * then a stable id tie-break for determinism. A Phase-2 model reasons more richly; this is the defensible
 * deterministic stand-in.
 *
 * <p><b>Amount sizing (owner-directed income proportionality, 2026-07-12):</b> the amount is a risk-scaled
 * slice of the customer's <em>annual income</em> ({@link #incomePercent aggressive 20% / moderate 10% /
 * conservative 5%}), which yields an <em>annual investment budget</em>. That budget is the LUMPSUM amount
 * as-is; for a SIP it is divided across twelve monthly instalments, so a suggested SIP is a monthly figure
 * that can never exceed what the customer earns in a year. When income is not on file (a real messy-data
 * case) it falls back to a {@value #ASSET_FALLBACK_PERCENT}% slice of investable assets; when neither is on
 * file, to {@value #DEFAULT_ANNUAL_BUDGET_INR}. Sizing from income — not assets — is the fix for the earlier
 * defect where an asset slice produced a monthly SIP larger than annual income.
 *
 * <p>Logging (§5): ids only — never the customer's name or the rationale prose (both are RM-facing UI,
 * not operational logs).
 */
@Service
public class RuleAwarePlanProposer implements PlanProposer {

    private static final Logger log = LoggerFactory.getLogger(RuleAwarePlanProposer.class);

    /** Asset-based fallback slice of the annual budget when annual income is not on file (see {@link #annualBudget}). */
    private static final int ASSET_FALLBACK_PERCENT = 10;
    /** Last-resort annual budget when neither income nor investable assets are on file. */
    private static final long DEFAULT_ANNUAL_BUDGET_INR = 100_000L;
    /** A lumpsum amount is rounded down to this unit for a tidy, human figure. */
    private static final long LUMPSUM_ROUNDING_INR = 10_000L;
    /** A SIP monthly instalment is rounded down to this (smaller) unit — instalments are smaller than lumpsums. */
    private static final long SIP_ROUNDING_INR = 1_000L;
    /** Months in a year — a SIP spreads the annual budget across this many monthly instalments. */
    private static final int MONTHS_PER_YEAR = 12;
    /** A stated horizon at or beyond this suggests a systematic plan (SIP) over a lumpsum. */
    private static final int SIP_HORIZON_MONTHS = 60;

    private final CustomerDirectory customers;
    private final SchemeCatalog schemes;
    private final EvaluationPipeline pipeline;

    public RuleAwarePlanProposer(CustomerDirectory customers, SchemeCatalog schemes,
            EvaluationPipeline pipeline) {
        this.customers = customers;
        this.schemes = schemes;
        this.pipeline = pipeline;
    }

    @Override
    public Optional<ProposedPlan> propose(UUID customerId, String rmId, String branchCode) {
        LocalDate today = LocalDate.now();
        CustomerProfile customer = customers.findProfile(customerId, today)
                .orElseThrow(() -> ResourceNotFoundException.customer(customerId));

        List<Scheme> catalogue = schemes.findAll();
        // The transaction shape depends only on the customer's horizon (not the scheme), so decide it once —
        // the amount is then sized against that shape (whole budget for a lumpsum, monthly instalment for a SIP).
        TransactionType type = suggestType(customer);
        List<Candidate> passing = new ArrayList<>();
        for (Scheme scheme : catalogue) {
            long amount = suggestAmount(customer, scheme, type);
            ProposedTransaction candidate = new ProposedTransaction(
                    customerId, scheme.schemeId(), amount, type, rmId, branchCode);
            EvaluationOutcome outcome = pipeline.screen(candidate);   // stages 1–3, nothing persisted
            if (outcome.verdict() == Verdict.PASS) {
                passing.add(new Candidate(scheme, amount, type, warnCount(outcome)));
            }
        }

        if (passing.isEmpty()) {
            log.info("No suitable plan for customer={}: screened {} schemes, none passed",
                    customerId, catalogue.size());
            return Optional.empty();
        }

        Candidate best = passing.stream().max(BY_FIT).orElseThrow();
        log.info("Suggested scheme={} for customer={} (screened {} schemes, {} passed)",
                best.scheme().schemeId(), customerId, catalogue.size(), passing.size());
        return Optional.of(new ProposedPlan(
                best.scheme().schemeId(), best.scheme().name(), best.amount(), best.type(),
                buildRationale(customer, best)));
    }

    /**
     * Size a suggested amount for the given transaction shape, floored at the scheme minimum.
     *
     * <p>The {@link #annualBudget annual budget} is the LUMPSUM amount as-is; a SIP divides it into twelve
     * monthly instalments — so the figure returned for a SIP is a <em>monthly</em> amount. That is the
     * crucial semantic that stops a suggested SIP from ever reading larger than annual income (the earlier
     * defect). Each shape is rounded DOWN to its own tidy unit (lumpsum {@value #LUMPSUM_ROUNDING_INR}, SIP
     * instalment {@value #SIP_ROUNDING_INR}) and never below one unit, so the result is never zero; it is
     * then floored at the scheme minimum (a proposal below the minimum would be invalid). The returned
     * amount is therefore always valid and non-zero.
     */
    private long suggestAmount(CustomerProfile customer, Scheme scheme, TransactionType type) {
        long annualBudget = annualBudget(customer);
        boolean sip = type == TransactionType.SIP;
        long raw = sip ? annualBudget / MONTHS_PER_YEAR : annualBudget;   // SIP = one monthly instalment; lumpsum = whole budget
        long unit = sip ? SIP_ROUNDING_INR : LUMPSUM_ROUNDING_INR;
        long tidy = Math.max(unit, (raw / unit) * unit);                  // round down to the unit, never below one unit (never zero)
        return Math.max(tidy, scheme.minInvestmentInr());
    }

    /**
     * The customer's annual investment budget — a risk-scaled slice of ANNUAL INCOME (owner-directed
     * income-proportionality rule, 2026-07-12; see {@link #incomePercent}). Income is the honest basis
     * because sizing a SIP from it keeps a monthly instalment within what the customer earns.
     *
     * <p>Fallbacks for the realistic messy-data cases (the nullable fields documented on
     * {@link CustomerProfile}): income not on file → a {@value #ASSET_FALLBACK_PERCENT}% slice of investable
     * assets; neither income nor assets on file → {@value #DEFAULT_ANNUAL_BUDGET_INR}.
     */
    private static long annualBudget(CustomerProfile customer) {
        Long income = customer.annualIncomeInr();
        if (income != null && income > 0) {
            return income * incomePercent(customer.riskCategory()) / 100;
        }
        Long assets = customer.investableAssetsInr();
        if (assets != null && assets > 0) {
            return assets * ASSET_FALLBACK_PERCENT / 100;
        }
        return DEFAULT_ANNUAL_BUDGET_INR;
    }

    /**
     * Owner-directed income-proportionality rule (2026-07-12): the percentage of annual income that becomes
     * the investment budget, scaled by stated risk appetite — an aggressive investor commits a larger share,
     * a conservative one a smaller share, with moderate in between. The exhaustive switch means a future
     * {@link RiskCategory} value forces a compile error here rather than silently taking a default.
     */
    private static int incomePercent(RiskCategory risk) {
        return switch (risk) {
            case CONSERVATIVE -> 5;
            case MODERATE -> 10;
            case AGGRESSIVE -> 20;
        };
    }

    /** A long stated horizon suits a systematic plan; otherwise a lumpsum. */
    private TransactionType suggestType(CustomerProfile customer) {
        Integer horizon = customer.investmentHorizonMonths();
        return (horizon != null && horizon >= SIP_HORIZON_MONTHS)
                ? TransactionType.SIP : TransactionType.LUMPSUM;
    }

    /**
     * The RM-facing rationale sentence. References the client and scheme (RM-facing UI, not a log), states
     * that the plan clears the gate, and cites the suggested amount.
     */
    private String buildRationale(CustomerProfile customer, Candidate best) {
        return String.format(Locale.ENGLISH,
                "Given %s's %s risk profile, %s (%s risk) clears all suitability checks — suggested %s of ₹%s.",
                customer.fullName(),
                humanize(customer.riskCategory().name()),
                best.scheme().name(),
                humanize(best.scheme().riskometerLevel().name()),
                best.type() == TransactionType.SIP ? "a monthly SIP" : "a lumpsum",
                indianGrouping(best.amount()));
    }

    /**
     * Indian digit grouping ({@code 500000 → "5,00,000"}) — the app's rupee convention (the frontend's
     * {@code formatInr} groups the same way). Done explicitly because the JDK's {@code en-IN}
     * {@link java.text.NumberFormat} does not apply the 2-2-3 Indian pattern in this runtime; a small,
     * deterministic grouping is more honest than a locale that silently falls back to 3-digit grouping.
     */
    private static String indianGrouping(long amount) {
        String digits = Long.toString(amount);
        if (digits.length() <= 3) {
            return digits;
        }
        String head = digits.substring(0, digits.length() - 3);   // all but the last three digits
        String tail = digits.substring(digits.length() - 3);      // the final three, always one group
        StringBuilder grouped = new StringBuilder();
        int sinceComma = 0;
        for (int i = head.length() - 1; i >= 0; i--) {            // group the head in twos, right to left
            grouped.append(head.charAt(i));
            if (++sinceComma == 2 && i > 0) {
                grouped.append(',');
                sinceComma = 0;
            }
        }
        return grouped.reverse().append(',').append(tail).toString();
    }

    /** Count of WARN-severity failures — annotations that don't block but make a fit less clean. */
    private static long warnCount(EvaluationOutcome outcome) {
        return outcome.results().stream()
                .filter(result -> result.severity() == Severity.WARN && result.outcome() == Outcome.FAIL)
                .count();
    }

    /** {@code VERY_HIGH} → {@code very high}; for prose only (the exact enum stays in structured data). */
    private static String humanize(String enumName) {
        return enumName.toLowerCase(Locale.ROOT).replace('_', ' ');
    }

    /**
     * "Higher is better" ordering used with {@link java.util.stream.Stream#max}: highest passing
     * riskometer first (most suitable growth), then fewer WARNs, then lower minimum investment, then a
     * stable id tie-break so the choice is fully deterministic.
     */
    private static final Comparator<Candidate> BY_FIT = Comparator
            .<Candidate>comparingInt(candidate -> candidate.scheme().riskometerLevel().ordinal())
            .thenComparingLong(candidate -> -candidate.warnCount())
            .thenComparingLong(candidate -> -candidate.scheme().minInvestmentInr())
            .thenComparing(candidate -> candidate.scheme().schemeId().toString());

    /** A scheme that passed the gate, with the amount/type screened and its WARN count (for ranking). */
    private record Candidate(Scheme scheme, long amount, TransactionType type, long warnCount) {}
}
