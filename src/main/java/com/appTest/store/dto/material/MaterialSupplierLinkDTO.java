package com.appTest.store.dto.material;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter
@Setter
public class MaterialSupplierLinkDTO implements Serializable {

    private Long idMaterialSupplier;

    private Long supplierId;
    private String supplierCompany;
    private String supplierContactName;
    private String supplierStatus;

    private BigDecimal priceUnit;
    private Integer deliveryTimeDays;

    public MaterialSupplierLinkDTO() {}

    public MaterialSupplierLinkDTO(Long idMaterialSupplier,
                                   Long supplierId,
                                   String supplierCompany,
                                   String supplierContactName,
                                   String supplierStatus,
                                   BigDecimal priceUnit,
                                   Integer deliveryTimeDays) {
        this.idMaterialSupplier = idMaterialSupplier;
        this.supplierId = supplierId;
        this.supplierCompany = supplierCompany;
        this.supplierContactName = supplierContactName;
        this.supplierStatus = supplierStatus;
        this.priceUnit = priceUnit;
        this.deliveryTimeDays = deliveryTimeDays;
    }
}