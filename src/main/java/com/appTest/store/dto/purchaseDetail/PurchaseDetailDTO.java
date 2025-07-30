package com.appTest.store.dto.purchaseDetail;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter
@Setter
@JsonPropertyOrder({ "idPurchaseDetail", "purchaseId", "materialName", "quantity", "priceUni"})
public class PurchaseDetailDTO implements Serializable {
    private Long idPurchaseDetail;
    private Long purchaseId;
    private BigDecimal quantity;
    private BigDecimal priceUni;
    private String materialName;

    public PurchaseDetailDTO() {}

    public PurchaseDetailDTO(Long idPurchaseDetail, Long purchaseId, String materialName, BigDecimal priceUni, BigDecimal quantity) {
        this.idPurchaseDetail = idPurchaseDetail;
        this.purchaseId = purchaseId;
        this.materialName = materialName;
        this.priceUni = priceUni;
        this.quantity = quantity;
    }
}
