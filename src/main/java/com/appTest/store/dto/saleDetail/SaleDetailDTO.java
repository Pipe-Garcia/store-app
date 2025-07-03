package com.appTest.store.dto.saleDetail;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({ "materialName", "quantity", "priceUni", "deliveryId", "deliveryDate" })
public class SaleDetailDTO implements Serializable {
    private BigDecimal quantity;
    private BigDecimal priceUni;
    private String materialName;
    private Long deliveryId;
    private LocalDate deliveryDate;

    public SaleDetailDTO() {}

    public SaleDetailDTO(BigDecimal priceUni, String materialName, BigDecimal quantity, Long deliveryId, LocalDate deliveryDate) {
        this.priceUni = priceUni;
        this.materialName = materialName;
        this.quantity = quantity;
        this.deliveryId = deliveryId;
        this.deliveryDate = deliveryDate;
    }
}
