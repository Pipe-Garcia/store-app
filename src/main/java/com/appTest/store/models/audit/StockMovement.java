package com.appTest.store.models.audit;

import jakarta.persistence.*;
import lombok.Getter; import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity @Getter @Setter
public class StockMovement {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable=false) private LocalDateTime timestamp;

    @Column(nullable=false) private Long   materialId;
    @Column(nullable=false) private String materialName;
    @Column(nullable=false) private Long   warehouseId;
    @Column(nullable=false) private String warehouseName;

    @Column(nullable=false, precision=19, scale=3) private BigDecimal fromQty;
    @Column(nullable=false, precision=19, scale=3) private BigDecimal toQty;
    @Column(nullable=false, precision=19, scale=3) private BigDecimal delta;

    @Column(nullable=false, length=40) private String reason;
    @Column(length=40) private String sourceType;
    private Long sourceId;

    private Long userId;
    private String userName;

    @Column(length=500) private String note;
    private String requestId;
}
