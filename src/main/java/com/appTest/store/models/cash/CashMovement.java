package com.appTest.store.models.cash;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Getter @Setter
@Table(name = "cash_movements")
public class CashMovement {

    public enum Direction { IN, OUT }

    // ✅ agregamos WITHDRAWAL (retiro al cierre)
    public enum Reason { SALE_PAYMENT, EXPENSE, PURCHASE, WITHDRAWAL }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name="session_id", nullable = false)
    private CashSession session;

    @Column(name="business_date", nullable = false)
    private LocalDate businessDate;

    @Column(name="ts", nullable = false)
    private LocalDateTime timestamp;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private Direction direction;

    @Column(nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 40)
    private String method; // CASH / TRANSFER / CARD / OTHER

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private Reason reason;

    @Column(name="source_type", length = 40)
    private String sourceType;

    @Column(name="source_id")
    private Long sourceId;

    @Column(name="user_name", length = 100)
    private String userName;

    @Column(length = 500)
    private String note;
}