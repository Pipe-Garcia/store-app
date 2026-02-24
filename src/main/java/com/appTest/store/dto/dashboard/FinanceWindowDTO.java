package com.appTest.store.dto.dashboard;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record FinanceWindowDTO(
        LocalDate from,
        LocalDate to,
        BigDecimal incomeTotal,
        BigDecimal expenseTotal,      // OUT sin WITHDRAWAL
        BigDecimal purchasesTotal,    // OUT PURCHASE
        BigDecimal expensesTotal,     // OUT EXPENSE
        BigDecimal withdrawalsTotal,  // OUT WITHDRAWAL
        BigDecimal netTotal,          // income - expense
        List<FinanceBreakdownDTO> incomeByMethod,
        List<FinanceBreakdownDTO> outByReason
) {}