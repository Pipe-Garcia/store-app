package com.appTest.store.dto.cash;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter @Setter
@AllArgsConstructor
public class CashSummaryRowDTO {
    private String direction; // IN/OUT
    private String method;    // CASH/TRANSFER/...
    private BigDecimal total;
}