package com.appTest.store.dto.reservation;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Getter; import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
public class ConsumeRequestDTO implements Serializable {
    @NotNull private Long clientId;
    @NotNull private Long materialId;
    private Long warehouseId; // si null, consume en cualquier depósito

    @NotNull @Positive
    private BigDecimal quantity;
}
