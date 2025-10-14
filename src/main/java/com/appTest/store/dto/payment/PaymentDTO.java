package com.appTest.store.dto.payment;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({ "idPayment", "amount", "datePayment", "methodPayment", "status", "saleId", "clientName"})
public class PaymentDTO implements Serializable {
    private Long idPayment;
    private BigDecimal amount;
    private LocalDate datePayment;
    private String methodPayment;
    private String status;
    private Long saleId;
    private String clientName;

    public PaymentDTO() {}

    public PaymentDTO(Long idPayment, BigDecimal amount, LocalDate datePayment, String methodPayment, String status, Long saleId, String clientName) {
        this.idPayment = idPayment;
        this.amount = amount;
        this.datePayment = datePayment;
        this.methodPayment = methodPayment;
        this.status = status;
        this.saleId = saleId;
        this.clientName = clientName;
    }
}