package com.appTest.store.dto.delivery;

import jakarta.validation.constraints.DecimalMin;
import lombok.Getter; import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
public class DeliveryItemUpsertDTO implements Serializable {
    private Long idDeliveryItem;     // si viene → update
    private Long orderDetailId;      // si no hay id → upsert por (orderDetailId + materialId)
    private Long materialId;
    private Long warehouseId;
    @DecimalMin("0.0000")
    private BigDecimal quantityDelivered; // puede ser 0 → reponer stock
}
