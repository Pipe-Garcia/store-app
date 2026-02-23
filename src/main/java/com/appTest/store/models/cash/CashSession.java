package com.appTest.store.models.cash;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Getter @Setter
@Table(name = "cash_sessions")
public class CashSession {

    public enum Status { OPEN, CLOSED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name="business_date", nullable = false)
    private LocalDate businessDate;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Status status;

    @Column(name="opened_at", nullable = false)
    private LocalDateTime openedAt;

    @Column(name="opened_by", nullable = false, length = 100)
    private String openedBy;

    @Column(name="opening_cash", nullable = false, precision = 19, scale = 2)
    private BigDecimal openingCash = BigDecimal.ZERO;

    @Column(name="closed_at")
    private LocalDateTime closedAt;

    @Column(name="closed_by", length = 100)
    private String closedBy;

    @Column(name="counted_cash", precision = 19, scale = 2)
    private BigDecimal countedCash;

    @Column(name="system_cash", precision = 19, scale = 2)
    private BigDecimal systemCash;

    @Column(name="difference_cash", precision = 19, scale = 2)
    private BigDecimal differenceCash;

    // ✅ NUEVO: retiro al cierre (NO es egreso)
    @Column(name="withdrawal_cash", precision = 19, scale = 2)
    private BigDecimal withdrawalCash;

    // ✅ NUEVO: efectivo que queda para abrir mañana (= contado - retiro)
    @Column(name="carry_over_cash", precision = 19, scale = 2)
    private BigDecimal carryOverCash;

    @Column(length = 500)
    private String note;
}