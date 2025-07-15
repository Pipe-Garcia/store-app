package com.appTest.store.dto.orderDetail;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
@JsonPropertyOrder({"idOrderDetail", "materialName", "priceUni", "quantity"})
public class OrderDetailDTO implements Serializable {
    private Long idOrderDetail;
    private String materialName;
    private BigDecimal priceUni;
    private BigDecimal quantity;

    public OrderDetailDTO() {}

    public OrderDetailDTO(Long idOrderDetail, String materialName, BigDecimal priceUni, BigDecimal quantity) {
        this.idOrderDetail = idOrderDetail;
        this.materialName = materialName;
        this.priceUni = priceUni;
        this.quantity = quantity;
    }
}
