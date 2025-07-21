package com.appTest.store.dto.payment;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
public class PaymentCreateDTO implements Serializable {

    @NotNull(message = "Amount is required")
    private BigDecimal amount;

    @NotNull(message = "Payment date is required")
    private LocalDate datePayment;

    @NotNull(message = "Payment method is required")
    private String methodPayment;

    private String status;

    private Long saleId;
}

