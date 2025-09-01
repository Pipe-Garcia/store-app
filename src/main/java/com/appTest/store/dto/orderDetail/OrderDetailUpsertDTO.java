package com.appTest.store.dto.orderDetail;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
public class OrderDetailUpsertDTO implements Serializable {
    // null => crear; con valor => actualizar ese detalle
    private Long idOrderDetail;

    @NotNull(message = "materialId is required")
    private Long materialId;

    @NotNull @Positive(message = "quantity must be > 0")
    private BigDecimal quantity;
}