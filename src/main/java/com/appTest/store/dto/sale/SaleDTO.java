// src/main/java/com/appTest/store/dto/sale/SaleDTO.java
package com.appTest.store.dto.sale;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
public class SaleDTO implements Serializable {

    private Long idSale;

    // Cliente
    private Long clientId;
    private String clientName;

    private LocalDate dateSale;

    // Totales monetarios
    private BigDecimal total;
    private BigDecimal paid;
    private BigDecimal balance;       // total - paid (>= 0)
    private String paymentStatus;     // PENDING | PARTIAL | PAID

    // Compat opcional
    private String paymentMethod;

    // Referencias
    private Long deliveryId;          // si hay exactamente 1 entrega, se setea a ese id
    private Long orderId;             // presupuesto de origen (si existe)

    // 🔴 NUEVO: resumen de unidades (venta ↔ entregas)
    private BigDecimal totalUnits;      // unidades vendidas en esta venta
    private BigDecimal deliveredUnits;  // unidades entregadas (todas las entregas de la venta)
    private BigDecimal pendingUnits;    // totalUnits - deliveredUnits (>= 0)
    private String deliveryStatus;      // NO_ITEMS | PENDING | PARTIAL | COMPLETED
}

