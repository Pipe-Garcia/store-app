// src/main/java/com/appTest/store/dto/saleDetail/SaleDetailLiteDTO.java
package com.appTest.store.dto.saleDetail;

import java.math.BigDecimal;

public class SaleDetailLiteDTO {

    private Long idSaleDetail;
    private Long materialId;
    private String materialName;
    private BigDecimal quantity;
    private BigDecimal unitPrice;

    // NUEVOS: info logística por renglón
    private BigDecimal quantityDelivered; // total entregado de este renglón
    private BigDecimal pendingQuantity;   // quantity - quantityDelivered

    public SaleDetailLiteDTO(Long idSaleDetail,
                             Long materialId,
                             String materialName,
                             BigDecimal quantity,
                             BigDecimal unitPrice) {
        this.idSaleDetail = idSaleDetail;
        this.materialId = materialId;
        this.materialName = materialName;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
    }

    // Nuevo constructor completo (dejamos el viejo para compatibilidad)
    public SaleDetailLiteDTO(Long idSaleDetail,
                             Long materialId,
                             String materialName,
                             BigDecimal quantity,
                             BigDecimal unitPrice,
                             BigDecimal quantityDelivered,
                             BigDecimal pendingQuantity) {
        this(idSaleDetail, materialId, materialName, quantity, unitPrice);
        this.quantityDelivered = quantityDelivered;
        this.pendingQuantity   = pendingQuantity;
    }

    public Long getIdSaleDetail() { return idSaleDetail; }
    public Long getMaterialId() { return materialId; }
    public String getMaterialName() { return materialName; }
    public BigDecimal getQuantity() { return quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }

    public void setIdSaleDetail(Long idSaleDetail) { this.idSaleDetail = idSaleDetail; }
    public void setMaterialId(Long materialId) { this.materialId = materialId; }
    public void setMaterialName(String materialName) { this.materialName = materialName; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }

    // getters/setters nuevos
    public BigDecimal getQuantityDelivered() { return quantityDelivered; }
    public void setQuantityDelivered(BigDecimal quantityDelivered) { this.quantityDelivered = quantityDelivered; }

    public BigDecimal getPendingQuantity() { return pendingQuantity; }
    public void setPendingQuantity(BigDecimal pendingQuantity) { this.pendingQuantity = pendingQuantity; }
}
