package com.appTest.store.dto.cash;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter @Setter
@AllArgsConstructor
public class CashSessionHistoryRowDTO {

    private Long sessionId;
    private LocalDate businessDate;

    private LocalDateTime openedAt;
    private BigDecimal openingCash;

    private LocalDateTime closedAt;
    private String closedBy;

    // Totales del día (para auditoría / neto)
    private BigDecimal incomeTotal;     // IN (todos)
    private BigDecimal expenseTotal;    // OUT + EXPENSE
    private BigDecimal purchaseTotal;   // OUT + PURCHASE
    private BigDecimal netTotal;        // income - (expense + purchase)

    // Caja física (no afecta neto)
    private BigDecimal withdrawalCash;  // retiro al cierre
    private BigDecimal carryOverCash;   // efectivo para mañana
}