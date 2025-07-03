package com.appTest.store.dto.sale;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Setter
public class SaleUpdateDTO implements Serializable {

    @NotNull(message = "Sale ID is required")
    private Long idSale;

    private LocalDate dateSale;

    @DecimalMin(value = "0.0", inclusive = false, message = "Total must be greater than zero")
    private BigDecimal total;

    @NotNull(message = "Client ID is required")
    private Long clientId;
}

