package com.appTest.store.dto.reservation;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

// Un ítem a reservar: material + depósito + cantidad
public record BulkReservationItem(
        @NotNull Long materialId,
        @NotNull Long warehouseId,
        @NotNull @DecimalMin(value = "1.0", message = "Quantity must be at least 1")
        BigDecimal quantity
) {}
