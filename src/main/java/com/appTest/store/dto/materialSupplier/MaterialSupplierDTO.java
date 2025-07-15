package com.appTest.store.dto.materialSupplier;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter
@Setter
@JsonPropertyOrder({ "idMaterialSupplier", "materialName", "supplierName", "priceUnit", "deliveryTimeDays" })
public class MaterialSupplierDTO implements Serializable {
    private Long idMaterialSupplier;
    private String materialName;
    private String supplierName;
    private BigDecimal priceUnit;
    private Integer deliveryTimeDays;

    public MaterialSupplierDTO() {}

    public MaterialSupplierDTO(Long idMaterialSupplier, String materialName, String supplierName, BigDecimal priceUnit, Integer deliveryTimeDays) {
        this.idMaterialSupplier = idMaterialSupplier;
        this.materialName = materialName;
        this.supplierName = supplierName;
        this.priceUnit = priceUnit;
        this.deliveryTimeDays = deliveryTimeDays;
    }
}
