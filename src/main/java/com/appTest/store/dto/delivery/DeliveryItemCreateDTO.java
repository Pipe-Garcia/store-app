package com.appTest.store.dto.delivery;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter; import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
public class DeliveryItemCreateDTO implements Serializable {
    @NotNull private Long orderDetailId;
    @NotNull private Long materialId;
    private Long warehouseId; // opcional
    @NotNull @DecimalMin("0.0001")
    private BigDecimal quantityDelivered;
}