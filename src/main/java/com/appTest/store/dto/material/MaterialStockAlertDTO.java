package com.appTest.store.dto.material;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
public class MaterialStockAlertDTO implements Serializable {
    private String name;
    private BigDecimal quantityAvailable;

    public MaterialStockAlertDTO() {}
    public MaterialStockAlertDTO(String name, BigDecimal quantityAvailable) {
        this.name = name;
        this.quantityAvailable = quantityAvailable;
    }
}

