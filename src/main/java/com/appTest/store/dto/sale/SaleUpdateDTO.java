package com.appTest.store.dto.sale;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;

@Getter
@Setter
public class SaleUpdateDTO implements Serializable {

    @NotNull(message = "Sale ID is required")
    private Long idSale;

    @NotNull(message = "Sale date is required")
    private LocalDate dateSale;

    @NotNull(message = "Total cannot be null")
    @DecimalMin(value = "0.0", inclusive = false, message = "Total must be greater than zero")
    private Double total;

    @NotNull(message = "Client ID is required")
    private Long clientId;
}

