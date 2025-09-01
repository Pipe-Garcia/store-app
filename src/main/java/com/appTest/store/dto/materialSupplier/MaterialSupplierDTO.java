package com.appTest.store.dto.materialSupplier;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter
@Setter
public class MaterialSupplierDTO implements Serializable {

    private Long idMaterialSupplier;

    private Long materialId;

    private String materialName; // Para mostrar en el frontend

    private BigDecimal priceUnit;

    private Integer deliveryTimeDays;

    public MaterialSupplierDTO() {}

    public MaterialSupplierDTO(Long idMaterialSupplier, Long materialId, String materialName,
                               BigDecimal priceUnit, Integer deliveryTimeDays) {
        this.idMaterialSupplier = idMaterialSupplier;
        this.materialId = materialId;
        this.materialName = materialName;
        this.priceUnit = priceUnit;
        this.deliveryTimeDays = deliveryTimeDays;
    }
}
