package com.appTest.store.dto.material;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
@JsonPropertyOrder({ "name", "brand", "price", "totalSales" })
public class MaterialDTO implements Serializable {
    private String name;
    private String brand;
    private BigDecimal price;
    private int totalSales;

    public MaterialDTO () {}
    public MaterialDTO(String brand, String name, BigDecimal price, int totalSales) {
        this.name = name;
        this.brand = brand;
        this.price = price;
        this.totalSales = totalSales;
    }
}
