package com.appTest.store.dto.material;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter
@Setter
public class MaterialUpdateDTO implements Serializable {

    @NotNull(message = "Material ID is required")
    private Long idMaterial;

    @Size(min = 2, max = 40, message = "Name must be between 2 and 40 characters")
    private String name;

    @Size(min = 1, max = 40, message = "Brand must be between 2 and 40 characters")
    private String brand;

    @DecimalMin(value = "0.0", inclusive = false, message = "Total must be greater than zero")
    private BigDecimal price;

}
