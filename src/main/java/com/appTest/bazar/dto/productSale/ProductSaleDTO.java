package com.appTest.bazar.dto.productSale;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({ "quantity", "priceUni", "dateSale", "productName" })
public class ProductSaleDTO implements Serializable {
    private Double quantity;
    private Double priceUni;
    private LocalDate dateSale;
    private String productName;

    public ProductSaleDTO () {}
    public ProductSaleDTO(LocalDate dateSale, Double priceUni, String productName, Double quantity) {
        this.quantity = quantity;
        this.priceUni = priceUni;
        this.dateSale = dateSale;
        this.productName = productName;
    }
}
