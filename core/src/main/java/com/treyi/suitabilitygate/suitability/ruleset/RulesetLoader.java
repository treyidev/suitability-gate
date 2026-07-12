package com.treyi.suitabilitygate.suitability.ruleset;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Loads the versioned ruleset YAML into the immutable {@link Ruleset} at startup.
 *
 * <p><b>Why an external file, not a classpath resource:</b> the canonical ruleset lives at the repo
 * top level ({@code ruleset/ruleset-*.yaml}) so compliance can tune thresholds without touching the
 * application (locked decision D13). There is deliberately NO classpath fallback copy — two copies
 * would drift, and a decision stamped "2026.07.1" must mean exactly one set of thresholds.
 *
 * <p><b>Fail-fast:</b> a missing/unreadable/invalid file aborts startup with a pointed message. A
 * suitability gate silently running without its thresholds would be worse than one that refuses to
 * start.
 *
 * <p>The path comes from {@code suitabilitygate.ruleset.path} (env override {@code RULESET_PATH});
 * dev default resolves relative to {@code core/}, docker-compose mounts the file and sets the env.
 */
@Configuration
public class RulesetLoader {

    private static final Logger log = LoggerFactory.getLogger(RulesetLoader.class);

    /**
     * Binds and validates the ruleset file; record compact constructors enforce structural invariants
     * (all four Phase-1 blocks present, bands non-empty, caps covering every risk category).
     *
     * @param path location of the ruleset YAML, from {@code suitabilitygate.ruleset.path}
     * @return the immutable ruleset singleton injected into the rules
     * @throws IOException           if the file cannot be parsed
     * @throws IllegalStateException if the file is missing or unreadable
     */
    @Bean
    Ruleset ruleset(@Value("${suitabilitygate.ruleset.path}") String path) throws IOException {
        Path file = Path.of(path);
        if (!Files.isReadable(file)) {
            throw new IllegalStateException(
                    "Ruleset file not found or unreadable: " + file.toAbsolutePath()
                            + " — set suitabilitygate.ruleset.path (env RULESET_PATH) to the canonical"
                            + " ruleset/ruleset-*.yaml");
        }
        ObjectMapper yaml = new ObjectMapper(new YAMLFactory());
        Ruleset ruleset = yaml.readValue(file.toFile(), Ruleset.class);
        log.info("Loaded ruleset version={} from {}", ruleset.version(), file.toAbsolutePath());
        return ruleset;
    }
}
