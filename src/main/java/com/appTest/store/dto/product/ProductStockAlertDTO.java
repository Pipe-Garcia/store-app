package com.appTest.store.dto.product;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
public class ProductStockAlertDTO implements Serializable {
    private String name;
    private Double quantityAvailable;

    public ProductStockAlertDTO() {}
    public ProductStockAlertDTO(String name, Double quantityAvailable) {
        this.name = name;
        this.quantityAvailable = quantityAvailable;
    }
}

