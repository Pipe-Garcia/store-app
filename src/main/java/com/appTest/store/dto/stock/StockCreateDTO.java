package com.appTest.store.dto.stock;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
@Getter @Setter
public class StockCreateDTO implements Serializable {
    @NotNull(message = "Material ID is required")
    private Long materialId;

    @NotNull(message = "Warehouse ID is required")
    private Long warehouseId;

    @NotNull(message = "An initial quantity is required")
    @DecimalMin(value = "0.0", message = "Quantity must be zero or greater")
    @Digits(integer = Integer.MAX_VALUE, fraction = 0, message = "Quantity must be an integer")
    private BigDecimal quantityAvailable;
}
