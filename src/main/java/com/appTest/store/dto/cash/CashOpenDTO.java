package com.appTest.store.dto.cash;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter @Setter
public class CashOpenDTO {
    @NotNull
    @DecimalMin(value = "0.00")
    private BigDecimal openingCash;

    private String note;
}