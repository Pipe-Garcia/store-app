package com.appTest.bazar.dto.productSale;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
public class ProductMostSoldDTO implements Serializable {
    private String productName;
    private Double totalUnitsSold;

    public ProductMostSoldDTO() {}

    public ProductMostSoldDTO(String productName, Double totalUnitsSold) {
        this.productName = productName;
        this.totalUnitsSold = totalUnitsSold;
    }
}


