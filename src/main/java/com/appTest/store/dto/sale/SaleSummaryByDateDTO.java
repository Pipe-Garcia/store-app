package com.appTest.store.dto.sale;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;


@Getter @Setter
public class SaleSummaryByDateDTO implements Serializable {
    private LocalDate date;
    private BigDecimal totalAmount;
    private Long totalSales; // <- Acá el fix

    public SaleSummaryByDateDTO() {}
    public SaleSummaryByDateDTO(LocalDate date, BigDecimal totalAmount, Long totalSales) {
        this.date = date;
        this.totalAmount = totalAmount;
        this.totalSales = totalSales;
    }
}


