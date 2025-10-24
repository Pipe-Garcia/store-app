// src/main/java/com/appTest/store/controllers/AuditDashboardController.java
package com.appTest.store.controllers;

import com.appTest.store.dto.auditdash.*;
import com.appTest.store.services.AuditDashService;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/audits")
public class AuditDashboardController {

    private final AuditDashService svc;

    public AuditDashboardController(AuditDashService svc){ this.svc = svc; }

    @GetMapping("/overview")
    @PreAuthorize("hasAnyRole('ROLE_OWNER','ROLE_EMPLOYEE')")
    public AuditOverviewDTO overview(){
        return svc.overview();
    }

    @GetMapping("/series-30d")
    @PreAuthorize("hasAnyRole('ROLE_OWNER','ROLE_EMPLOYEE')")
    public AuditSeries30DTO series30d(){
        return svc.series30d();
    }

    @GetMapping("/critical-latest")
    @PreAuthorize("hasAnyRole('ROLE_OWNER','ROLE_EMPLOYEE')")
    public List<CriticalItemDTO> latest(@RequestParam(defaultValue="5") int limit){
        return svc.latestCritical(limit);
    }

    // Donut de motivos de movimientos de stock (30d)
    @GetMapping("/stock-movements/summary-30d")
    @PreAuthorize("hasAnyRole('ROLE_OWNER','ROLE_EMPLOYEE')")
    public List<ReasonAggDTO> stockAgg30d(){
        return svc.stockReasonAgg30d();
    }
}
