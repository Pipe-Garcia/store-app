package com.appTest.store.dto.sale;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({ "dateSale", "total", "clientName", "paymentMethod" })
public class SaleDTO implements Serializable {
    private LocalDate dateSale;
    private BigDecimal total;
    private String clientName;
    private String paymentMethod;

    public SaleDTO () {}
    public SaleDTO(String clientName, LocalDate dateSale, BigDecimal total, String paymentMethod) {
        this.dateSale = dateSale;
        this.total = total;
        this.clientName = clientName;

    }
}
