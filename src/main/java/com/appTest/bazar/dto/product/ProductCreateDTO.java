package com.appTest.bazar.dto.product;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class ProductCreateDTO implements Serializable {

    @NotBlank(message = "Name cannot be blank")
    @Size(min = 2, max = 50)
    private String name;

    @NotBlank(message = "Brand cannot be blank")
    private String brand;

    @DecimalMin(value = "0.01", message = "Price must be greater than 0")
    private Double price;
}
