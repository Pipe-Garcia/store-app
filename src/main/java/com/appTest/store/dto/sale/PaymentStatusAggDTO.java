package com.appTest.store.dto.sale;

import java.math.BigDecimal;

public class PaymentStatusAggDTO {
    private String status;       // PAID / PARTIAL / PENDING (o tu enum.toString())
    private Long count;          // cantidad de ventas
    private BigDecimal amount;   // suma de montos

    public PaymentStatusAggDTO(String status, Long count, BigDecimal amount) {
        this.status = status;
        this.count = count;
        this.amount = amount;
    }
    public String getStatus() { return status; }
    public Long getCount() { return count; }
    public BigDecimal getAmount() { return amount; }
}
