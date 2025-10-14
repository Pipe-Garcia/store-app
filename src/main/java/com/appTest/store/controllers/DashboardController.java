package com.appTest.store.controllers;

import com.appTest.store.dto.dashboard.DashboardOverviewDTO;
import com.appTest.store.dto.dashboard.Sales30dDTO;
import com.appTest.store.dto.dashboard.StockoutRiskDTO;
import com.appTest.store.services.DashboardService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/dashboard")
@CrossOrigin(origins = "*")
public class DashboardController {

  private final DashboardService service;

  public DashboardController(DashboardService service) { this.service = service; }

  @GetMapping("/overview")
  public DashboardOverviewDTO overview() {
    return service.overview();
  }

  @GetMapping("/stockout-risk")
  public List<StockoutRiskDTO> stockoutRisk() {
        return service.listStockoutRisk();
  }

  @GetMapping("/sales-30d")
  public Sales30dDTO sales30d(){
    return service.salesLast30Days();
  }
}
