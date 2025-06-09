package com.appTest.bazar.dto.product;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
public class ProductMostExpensiveDTO implements Serializable {
    private String name;
    private Double price;

    public ProductMostExpensiveDTO() {}
    public ProductMostExpensiveDTO(String name, Double price) {
        this.name = name;
        this.price = price;
    }
}

