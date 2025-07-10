package com.appTest.store.dto.sale;

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

    private LocalDate dateSale;

    @NotNull(message = "Client ID is required")
    private Long clientId;
}

