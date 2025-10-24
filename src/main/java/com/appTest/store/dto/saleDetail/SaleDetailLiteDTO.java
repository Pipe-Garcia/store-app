package com.appTest.store.dto.saleDetail;

import java.math.BigDecimal;

public class SaleDetailLiteDTO {
    private Long materialId;
    private String materialName;
    private BigDecimal quantity;
    private BigDecimal unitPrice;

    public SaleDetailLiteDTO(Long materialId, String materialName, BigDecimal quantity, BigDecimal unitPrice) {
        this.materialId = materialId;
        this.materialName = materialName;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
    }

    public Long getMaterialId() { return materialId; }
    public String getMaterialName() { return materialName; }
    public BigDecimal getQuantity() { return quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }

    public void setMaterialId(Long materialId) { this.materialId = materialId; }
    public void setMaterialName(String materialName) { this.materialName = materialName; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }
}

