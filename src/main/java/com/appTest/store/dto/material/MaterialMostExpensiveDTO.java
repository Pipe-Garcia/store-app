package com.appTest.store.dto.material;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
public class MaterialMostExpensiveDTO implements Serializable {
    private String name;
    private BigDecimal price;

    public MaterialMostExpensiveDTO() {}
    public MaterialMostExpensiveDTO(String name, BigDecimal price) {
        this.name = name;
        this.price = price;
    }
}

