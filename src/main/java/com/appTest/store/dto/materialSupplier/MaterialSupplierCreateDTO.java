package com.appTest.store.dto.materialSupplier;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter
@Setter
public class MaterialSupplierCreateDTO implements Serializable {

    @NotNull(message = "Material ID is required")
    private Long materialId;

    @NotNull(message = "Supplier ID is required")
    private Long supplierId;

    @NotNull(message = "Price unit is required")
    @DecimalMin(value = "0.01", message = "Price unit must be greater than 0")
    private BigDecimal priceUnit;

    @Min(value = 0, message = "Delivery time must be at least 0 days")
    private Integer deliveryTimeDays;
}
