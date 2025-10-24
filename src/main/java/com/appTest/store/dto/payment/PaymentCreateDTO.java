package com.appTest.store.dto.payment;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
public class PaymentCreateDTO implements Serializable {

    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.01", message = "Amount must be greater than 0")
    private BigDecimal amount;

    @NotNull(message = "Payment date is required")
    private LocalDate datePayment;

    @NotBlank(message = "Payment method is required")
    private String methodPayment;

    private String status;
    private Long saleId;
}
