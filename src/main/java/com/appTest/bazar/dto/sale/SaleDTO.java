package com.appTest.bazar.dto.sale;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({ "dateSale", "total", "clientName" })
public class SaleDTO implements Serializable {
    private LocalDate dateSale;
    private Double total;
    private String clientName;

    public SaleDTO () {}
    public SaleDTO(String clientName, LocalDate dateSale, Double total) {
        this.dateSale = dateSale;
        this.total = total;
        this.clientName = clientName;
    }
}
