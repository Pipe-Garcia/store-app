package com.appTest.store.dto.payment;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
public class PaymentUpdateDTO implements Serializable {

    @NotNull(message = "Payment ID is required")
    private Long idPayment;

    private BigDecimal amount;
    private LocalDate datePayment;
    private String methodPayment;
    private String status;
}

