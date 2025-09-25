package com.appTest.store.dto.reservation;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@AllArgsConstructor       // ✅ constructor con todos los campos
@NoArgsConstructor        // ✅ constructor vacío (por si lo necesitas)
public class StockReservationDTO implements Serializable {
    private Long idReservation;
    private Long materialId;
    private String materialName;
    private Long warehouseId;
    private String warehouseName;
    private Long clientId;
    private String clientName;
    private Long orderId;
    private BigDecimal quantity;
    private LocalDate reservedAt;
    private LocalDate expiresAt;
    private String status;
}

