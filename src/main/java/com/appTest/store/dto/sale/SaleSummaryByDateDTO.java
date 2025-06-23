package com.appTest.store.dto.sale;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;


@Getter @Setter
public class SaleSummaryByDateDTO implements Serializable {
    private LocalDate date;
    private Double totalAmount;
    private Long totalSales; // <- Acá el fix

    public SaleSummaryByDateDTO() {}
    public SaleSummaryByDateDTO(LocalDate date, Double totalAmount, Long totalSales) {
        this.date = date;
        this.totalAmount = totalAmount;
        this.totalSales = totalSales;
    }
}


