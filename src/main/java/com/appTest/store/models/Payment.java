package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Entity
@Getter @Setter
public class Payment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idPayment;
    private Double amount;
    private LocalDate datePayment;
    private String methodPayment;
    private String status;
    @ManyToOne
    @JoinColumn(name = "sale_id")
    private Sale sale;

    public Payment() {}

    public Payment(Double amount, LocalDate datePayment, String methodPayment, Sale sale, String status) {
        this.amount = amount;
        this.datePayment = datePayment;
        this.methodPayment = methodPayment;
        this.sale = sale;
        this.status = status;
    }
}
