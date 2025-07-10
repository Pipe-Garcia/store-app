package com.appTest.store.dto.orderDetail;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
public class OrderDetailRequestDTO implements Serializable {


    @NotNull(message = "Material ID is required")
    private Long materialId;

    @NotNull(message = "Quantity is required")
    @DecimalMin(value = "1.0", message = "Quantity must be at least 1 unit")
    @Digits(integer = Integer.MAX_VALUE, fraction = 0, message = "Quantity must be an integer")
    private BigDecimal quantity;
}
