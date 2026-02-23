package com.appTest.store.dto.cash;

import com.appTest.store.models.cash.CashSession;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter @Setter
@AllArgsConstructor
public class CashSessionDTO {
    private Long id;
    private LocalDate businessDate;
    private String status;

    private LocalDateTime openedAt;
    private String openedBy;
    private BigDecimal openingCash;

    private LocalDateTime closedAt;
    private String closedBy;
    private BigDecimal countedCash;
    private BigDecimal systemCash;
    private BigDecimal differenceCash;

    // ✅ nuevos
    private BigDecimal withdrawalCash;
    private BigDecimal carryOverCash;

    private String note;

    public static CashSessionDTO from(CashSession s){
        return new CashSessionDTO(
                s.getId(),
                s.getBusinessDate(),
                s.getStatus() != null ? s.getStatus().name() : null,
                s.getOpenedAt(),
                s.getOpenedBy(),
                s.getOpeningCash(),
                s.getClosedAt(),
                s.getClosedBy(),
                s.getCountedCash(),
                s.getSystemCash(),
                s.getDifferenceCash(),
                s.getWithdrawalCash(),
                s.getCarryOverCash(),
                s.getNote()
        );
    }
}