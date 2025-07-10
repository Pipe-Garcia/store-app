package com.appTest.store.dto.materialSupplier;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter
@Setter
public class MaterialSupplierUpdateDTO implements Serializable {
    @NotNull(message = "Material Supplier ID is required")
    private Long idMaterialSupplier;

    private BigDecimal priceUnit;

    private Integer deliveryTimeDays;
}