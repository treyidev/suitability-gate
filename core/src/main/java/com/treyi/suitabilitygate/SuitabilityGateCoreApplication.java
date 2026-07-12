package com.treyi.suitabilitygate;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Application entry point. {@code @EnableAsync} powers the ONE async seam (D6): the explanation
 * module's {@code @Async} listener on {@code DecisionRecordedEvent}. Declared here (root package)
 * because async execution is application-level infrastructure, not any single module's concern —
 * and a root-level {@code config} subpackage would itself become a Modulith module.
 */
@SpringBootApplication
@EnableAsync
public class SuitabilityGateCoreApplication {

	public static void main(String[] args) {
		SpringApplication.run(SuitabilityGateCoreApplication.class, args);
	}

}
