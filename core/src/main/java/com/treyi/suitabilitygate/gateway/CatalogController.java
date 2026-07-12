package com.treyi.suitabilitygate.gateway;

import java.time.LocalDate;
import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.treyi.suitabilitygate.customerdata.CustomerDirectory;
import com.treyi.suitabilitygate.customerdata.CustomerProfile;
import com.treyi.suitabilitygate.schemecatalog.Scheme;
import com.treyi.suitabilitygate.schemecatalog.SchemeCatalog;

/**
 * HTTP entry points for the RM workbench's pickers — {@code GET /customers} and {@code GET /schemes}.
 *
 * <p>A thin BFF wrapper over the {@link CustomerDirectory} and {@link SchemeCatalog} ports (brief §3.1);
 * both roles may read either list (Access Control Matrix, CLAUDE.md §6) so there is no ownership filter
 * here, unlike {@link RecordController}.
 */
@RestController
public class CatalogController {

    private final CustomerDirectory customers;
    private final SchemeCatalog schemes;

    public CatalogController(CustomerDirectory customers, SchemeCatalog schemes) {
        this.customers = customers;
        this.schemes = schemes;
    }

    @GetMapping("/customers")
    @PreAuthorize("hasAnyRole('RM', 'COMPLIANCE')")
    public List<CustomerProfile> findCustomers() {
        return customers.findAll(LocalDate.now());
    }

    @GetMapping("/schemes")
    @PreAuthorize("hasAnyRole('RM', 'COMPLIANCE')")
    public List<Scheme> findSchemes() {
        return schemes.findAll();
    }
}
