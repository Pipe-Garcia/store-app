package com.appTest.store.dto.dashboard;

import java.math.BigDecimal;

public class TopClientDTO {
  private Long clientId;
  private String clientName;
  private BigDecimal amount;

  public TopClientDTO(Long clientId, String clientName, BigDecimal amount) {
    this.clientId = clientId;
    this.clientName = clientName;
    this.amount = amount;
  }
  public Long getClientId() { return clientId; }
  public String getClientName() { return clientName; }
  public BigDecimal getAmount() { return amount; }
}
