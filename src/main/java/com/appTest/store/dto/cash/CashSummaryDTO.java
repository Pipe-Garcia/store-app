package com.appTest.store.dto.cash;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter @Setter
@AllArgsConstructor
public class CashSummaryDTO {
    private LocalDate businessDate;
    private BigDecimal openingCash;
    private BigDecimal systemCashExpected; // opening + cashIN - cashOUT
    private List<CashSummaryRowDTO> rows;
}