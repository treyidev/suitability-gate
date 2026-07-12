package com.treyi.suitabilitygate;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

/**
 * Modulith boundary verification — one of only two permitted automated checks (locked decision D10;
 * the other is the golden-scenario script). This is not a unit-test suite: it asserts the
 * <em>architecture</em> holds. {@link ApplicationModules#verify()} fails the build if any module
 * reaches across a boundary, forms a dependency cycle, or references another module's internals.
 *
 * <p>Because the module map is a build property rather than a diagram, "modules communicate only via
 * published APIs" is enforced by the compiler/build, not by convention — a core pitch asset.
 *
 * <p>Runs a static analysis of the package structure; it does <strong>not</strong> bootstrap a Spring
 * context, so it needs no datasource. Keep it green at all times.
 */
class ApplicationModulesTest {

    private static final ApplicationModules MODULES =
            ApplicationModules.of(SuitabilityGateCoreApplication.class);

    @Test
    void verifiesModuleBoundaries() {
        MODULES.verify();
    }
}
