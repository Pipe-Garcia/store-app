package com.appTest.store.dto.saleDetail;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
public class MaterialMostSoldDTO implements Serializable {
    private String materialName;
    private BigDecimal totalUnitsSold;

    public MaterialMostSoldDTO() {}

    public MaterialMostSoldDTO(String materialName, BigDecimal totalUnitsSold) {
        this.materialName = materialName;
        this.totalUnitsSold = totalUnitsSold;
    }
}


