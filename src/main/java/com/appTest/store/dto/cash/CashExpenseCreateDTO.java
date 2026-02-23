package com.appTest.store.dto.cash;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter @Setter
public class CashExpenseCreateDTO {

    @NotNull
    @DecimalMin(value = "0.01", message = "Amount must be > 0")
    private BigDecimal amount;

    // ✅ ya NO obligatorio (front no lo manda); backend fuerza CASH
    private String method;

    @NotBlank(message = "Note (reason) is required")
    private String note;

    private String reference;
}