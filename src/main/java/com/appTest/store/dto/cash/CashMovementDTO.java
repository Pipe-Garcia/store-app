package com.appTest.store.dto.cash;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter @Setter
@AllArgsConstructor
public class CashMovementDTO {
    private Long id;
    private Long sessionId;
    private LocalDate businessDate;
    private LocalDateTime timestamp;

    private String direction; // IN/OUT
    private BigDecimal amount;

    private String method;
    private String reason;

    private String sourceType;
    private Long sourceId;

    private String userName;
    private String note;
}