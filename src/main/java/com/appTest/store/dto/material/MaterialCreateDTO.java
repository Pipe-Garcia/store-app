package com.appTest.store.dto.material;

import jakarta.validation.constraints.*;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
public class MaterialCreateDTO implements Serializable {

    @NotBlank(message = "Name cannot be blank")
    @Size(min = 2, max = 50)
    private String name;

    @NotBlank(message = "Brand cannot be blank")
    private String brand;

    @DecimalMin(value = "0.01", message = "Price ARS must be greater than 0")
    private BigDecimal priceArs;

    @DecimalMin(value = "0.01", message = "Price USD must be greater than 0")
    private BigDecimal priceUsd;

    private String measurementUnit;

    private String internalNumber;

    private String description;

    @NotNull(message = "Family ID is required")
    private Long familyId;

    // 🔽 Campos adicionales para el stock inicial
    @DecimalMin(value = "0.0", inclusive = false, message = "Initial quantity must be greater than 0")
    private BigDecimal initialQuantity;

    private Long warehouseId;
}

