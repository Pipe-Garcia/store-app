package com.appTest.store.dto.dashboard;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record FinanceSeriesDTO(
        List<Point> points
) {
    public record Point(
            LocalDate date,
            BigDecimal income,      // IN total
            BigDecimal expense,     // OUT sin WITHDRAWAL
            BigDecimal purchases,   // OUT reason=PURCHASE
            BigDecimal expenses,    // OUT reason=EXPENSE
            BigDecimal withdrawals, // OUT reason=WITHDRAWAL (se muestra aparte)
            BigDecimal net          // income - expense
    ) {}
}