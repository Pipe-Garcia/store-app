package com.appTest.store.dto.saleDetail;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
@JsonPropertyOrder({ "idSaleDetail", "materialName", "quantity", "priceUni"})
public class SaleDetailDTO implements Serializable {
    private Long idSaleDetail;
    private BigDecimal quantity;
    private BigDecimal priceUni;
    private String materialName;

    public SaleDetailDTO() {}

    public SaleDetailDTO(Long idSaleDetail, BigDecimal priceUni, String materialName, BigDecimal quantity) {
        this.idSaleDetail = idSaleDetail;
        this.priceUni = priceUni;
        this.materialName = materialName;
        this.quantity = quantity;
    }
}
