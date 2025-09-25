package com.appTest.store.dto.reservation;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter; import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
public class StockReservationCreateDTO implements Serializable {

    @NotNull
    private Long materialId;

    @NotNull
    private Long warehouseId;

    private Long clientId;

    @NotNull(message = "Order ID is required")
    private Long orderId;

    @NotNull
    @Positive
    private BigDecimal quantity;

    private LocalDate expiresAt; // opcional
}
