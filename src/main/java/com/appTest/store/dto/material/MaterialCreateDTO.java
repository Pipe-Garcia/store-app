package com.appTest.store.dto.material;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter
@Setter
public class MaterialCreateDTO implements Serializable {

    @NotBlank(message = "Name cannot be blank")
    @Size(min = 2, max = 50)
    private String name;

    @NotBlank(message = "Brand cannot be blank")
    private String brand;

    @DecimalMin(value = "0.01", message = "Price must be greater than 0")
    private BigDecimal priceArs;

    @DecimalMin(value = "0.01", message = "Price must be greater than 0")
    private BigDecimal priceUsd;

    private BigDecimal measurementUnit;

    private Long internalNumber;

    @NotNull(message = "Family ID is required")
    private Long familyId;
}
