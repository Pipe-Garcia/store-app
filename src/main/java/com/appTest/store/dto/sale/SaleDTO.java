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
    private BigDecimal balance;
    private String paymentStatus;

    private String paymentMethod;

    // Referencias
    private Long deliveryId;
    private Long orderId;

    // Logística
    private BigDecimal totalUnits;
    private BigDecimal deliveredUnits;
    private BigDecimal pendingUnits;
    private String deliveryStatus;

    private String status; // ACTIVE | CANCELLED
}