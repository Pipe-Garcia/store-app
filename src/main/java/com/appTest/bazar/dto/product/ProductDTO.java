package com.appTest.bazar.dto.product;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
@JsonPropertyOrder({ "name", "brand", "price", "quantityAvailable", "totalSales" })
public class ProductDTO implements Serializable {
    private String name;
    private String brand;
    private Double price;
    private Double quantityAvailable;
    private int totalSales;

    public ProductDTO () {}
    public ProductDTO(String brand, String name, Double price, Double quantityAvailable, int totalSales) {
        this.name = name;
        this.brand = brand;
        this.price = price;
        this.quantityAvailable = quantityAvailable;
        this.totalSales = totalSales;
    }
}
