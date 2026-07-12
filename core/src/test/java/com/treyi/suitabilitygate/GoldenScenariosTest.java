package com.treyi.suitabilitygate;

import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.junit.jupiter.api.Test;

import com.treyi.suitabilitygate.customerdata.synthetic.SyntheticCustomerAdapter;
import com.treyi.suitabilitygate.schemecatalog.synthetic.SyntheticSchemeAdapter;
import com.treyi.suitabilitygate.suitability.DecisionDraft;
import com.treyi.suitabilitygate.suitability.DecisionLedger;
import com.treyi.suitabilitygate.suitability.DecisionRecord;
import com.treyi.suitabilitygate.suitability.EvaluationPipeline;
import com.treyi.suitabilitygate.suitability.Outcome;
import com.treyi.suitabilitygate.suitability.OverrideEvent;
import com.treyi.suitabilitygate.suitability.OverrideStatus;
import com.treyi.suitabilitygate.suitability.ProposedTransaction;
import com.treyi.suitabilitygate.suitability.RuleResult;
import com.treyi.suitabilitygate.suitability.SuitabilityRule;
import com.treyi.suitabilitygate.suitability.TransactionType;
import com.treyi.suitabilitygate.suitability.Verdict;
import com.treyi.suitabilitygate.suitability.engine.NativeSuitabilityEvaluator;
import com.treyi.suitabilitygate.suitability.ruleset.Ruleset;
import com.treyi.suitabilitygate.suitability.rules.AgeRiskBandRule;
import com.treyi.suitabilitygate.suitability.rules.HorizonLockinRule;
import com.treyi.suitabilitygate.suitability.rules.SeniorEnhancedRule;
import com.treyi.suitabilitygate.suitability.rules.StatedRiskMatchRule;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The golden-scenario acceptance gate — one of ONLY two sanctioned automated checks (brief D10; the
 * other is {@link ApplicationModulesTest}). It runs the demo-critical scenarios against the REAL
 * pipeline and its rules, and MUST stay green after every change to rules, pipeline, or ruleset config.
 *
 * <p>Phase 1 covers scenarios 1, 2, 4 (Sharma FLAG / clean PASS / HORIZON_LOCKIN FLAG) per the MVP-slice
 * amendment. Scenarios 3, 5, 6, 7 return in Phase 2 with the rules/flows they exercise.
 *
 * <p>Self-contained by design: it wires the real components (rules, adapters, evaluator, pipeline) and
 * loads the real ruleset YAML, using an in-memory test ledger so the gate needs no database to run.
 * Persistence is proven separately.
 */
class GoldenScenariosTest {

    private static final String RULESET_PATH = "../ruleset/ruleset-2026.07.1.yaml";

    @Test
    void scenario1_sharma_smallCap_isFlaggedByThreeRules() {
        DecisionRecord record = evaluate(SyntheticCustomerAdapter.SHARMA, SyntheticSchemeAdapter.SMALL_CAP);

        assertThat(record.verdict()).isEqualTo(Verdict.FLAGGED);
        assertThat(failedRuleIds(record))
                .contains("AGE_RISK_BAND", "STATED_RISK_MATCH", "SENIOR_ENHANCED");
    }

    @Test
    void scenario2_aggressive34_largeCap_passesCleanly() {
        DecisionRecord record = evaluate(SyntheticCustomerAdapter.ROHAN, SyntheticSchemeAdapter.LARGE_CAP);

        assertThat(record.verdict()).isEqualTo(Verdict.PASS);
        assertThat(record.ruleResults()).noneMatch(RuleResult::isBlockingFailure);
    }

    @Test
    void scenario4_shortHorizon_elss_isFlaggedByHorizonLockin() {
        DecisionRecord record = evaluate(SyntheticCustomerAdapter.PRIYA, SyntheticSchemeAdapter.ELSS);

        assertThat(record.verdict()).isEqualTo(Verdict.FLAGGED);
        assertThat(failedRuleIds(record)).contains("HORIZON_LOCKIN");
    }

    // ── wiring of the real pipeline ────────────────────────────────────────────

    private DecisionRecord evaluate(UUID customerId, UUID schemeId) {
        return newPipeline().evaluate(new ProposedTransaction(customerId, schemeId, 100_000L,
                TransactionType.LUMPSUM, "rm.demo", "PUNE-01"));
    }

    private EvaluationPipeline newPipeline() {
        Ruleset ruleset = loadRuleset();
        List<SuitabilityRule> rules = List.of(
                new AgeRiskBandRule(ruleset),
                new StatedRiskMatchRule(ruleset),
                new SeniorEnhancedRule(ruleset),
                new HorizonLockinRule(ruleset));
        // The event published after recording is irrelevant to the golden gate — discard it.
        return new EvaluationPipeline(new SyntheticCustomerAdapter(), new SyntheticSchemeAdapter(),
                new NativeSuitabilityEvaluator(rules), new InMemoryTestLedger(), ruleset, event -> {
                });
    }

    private Ruleset loadRuleset() {
        try {
            return new ObjectMapper(new YAMLFactory()).readValue(new File(RULESET_PATH), Ruleset.class);
        } catch (IOException ex) {
            throw new IllegalStateException("Golden scenarios could not load ruleset " + RULESET_PATH, ex);
        }
    }

    private Set<String> failedRuleIds(DecisionRecord record) {
        return record.ruleResults().stream()
                .filter(result -> result.outcome() == Outcome.FAIL)
                .map(RuleResult::ruleId)
                .collect(Collectors.toSet());
    }

    /** Minimal in-memory ledger for the gate — assigns identity, no persistence. Test-only. */
    private static final class InMemoryTestLedger implements DecisionLedger {

        private final AtomicLong sequence = new AtomicLong();

        @Override
        public DecisionRecord record(DecisionDraft draft) {
            long number = sequence.incrementAndGet();
            return new DecisionRecord(UUID.randomUUID(), "SG-TEST-%06d".formatted(number), Instant.now(),
                    draft.proposal(), draft.customerSnapshot(), draft.holdingsSnapshot(),
                    draft.schemeSnapshot(), draft.ruleResults(), draft.verdict(), draft.verdictReason(),
                    draft.aiContribution(), draft.provenance(), List.of());
        }

        @Override
        public Optional<DecisionRecord> findById(UUID recordId) {
            return Optional.empty();
        }

        @Override
        public void attachExplanation(UUID recordId, String provider, String explanationText) {
            // Explanations are outside the golden gate's scope; nothing to store.
        }

        @Override
        public void markExplanationFailed(UUID recordId) {
            // Explanations are outside the golden gate's scope; nothing to store.
        }

        @Override
        public List<DecisionRecord> findAll() {
            // The golden gate evaluates single decisions; the whole-ledger read is not exercised here.
            return List.of();
        }

        @Override
        public List<DecisionRecord> findByCustomerId(UUID customerId) {
            // The customer transparency-portal read is not exercised by the golden gate; the port method
            // must still be implemented here or a clean build fails (the findAll gap that bit us before).
            return List.of();
        }

        @Override
        public OverrideEvent attachOverride(UUID recordId, OverrideStatus resultingStatus,
                String justification, String overriddenBy) {
            // Supervisor reviews are outside the golden gate's scope.
            throw new UnsupportedOperationException("attachOverride is not exercised by the golden gate");
        }
    }
}
