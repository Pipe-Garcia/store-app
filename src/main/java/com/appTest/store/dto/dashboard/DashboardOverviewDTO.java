package com.appTest.store.dto.dashboard;

import java.math.BigDecimal;
import java.util.List;

public class DashboardOverviewDTO {
  // Cuentas por cobrar
  private BigDecimal receivablesTotal;
  private Long receivablesCount;

  // Pedidos sin convertir (backlog)
  private Long openOrdersCount;
  private BigDecimal openOrdersValue;

  // Entregas
  private Long deliveriesToday;
  private Long deliveriesTomorrow;

  // Riesgo de stockout
  private Long stockoutRiskCount;

  // Top clientes del mes
  private List<TopClientDTO> topClientsMonth;

  public DashboardOverviewDTO(BigDecimal receivablesTotal, Long receivablesCount,
                              Long openOrdersCount, BigDecimal openOrdersValue,
                              Long deliveriesToday, Long deliveriesTomorrow,
                              Long stockoutRiskCount, List<TopClientDTO> topClientsMonth) {
    this.receivablesTotal = receivablesTotal;
    this.receivablesCount = receivablesCount;
    this.openOrdersCount = openOrdersCount;
    this.openOrdersValue = openOrdersValue;
    this.deliveriesToday = deliveriesToday;
    this.deliveriesTomorrow = deliveriesTomorrow;
    this.stockoutRiskCount = stockoutRiskCount;
    this.topClientsMonth = topClientsMonth;
  }

  public BigDecimal getReceivablesTotal(){ return receivablesTotal; }
  public Long getReceivablesCount(){ return receivablesCount; }
  public Long getOpenOrdersCount(){ return openOrdersCount; }
  public BigDecimal getOpenOrdersValue(){ return openOrdersValue; }
  public Long getDeliveriesToday(){ return deliveriesToday; }
  public Long getDeliveriesTomorrow(){ return deliveriesTomorrow; }
  public Long getStockoutRiskCount(){ return stockoutRiskCount; }
  public List<TopClientDTO> getTopClientsMonth(){ return topClientsMonth; }
}
