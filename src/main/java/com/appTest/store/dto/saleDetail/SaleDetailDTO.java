package com.appTest.store.dto.saleDetail;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({ "quantity", "priceUni", "dateSale", "materialName" })
public class SaleDetailDTO implements Serializable {
    private BigDecimal quantity;
    private BigDecimal priceUni;
    private LocalDate dateSale;
    private String materialName;

    public SaleDetailDTO () {}
    public SaleDetailDTO(LocalDate dateSale, BigDecimal priceUni, String materialName, BigDecimal quantity) {
        this.quantity = quantity;
        this.priceUni = priceUni;
        this.dateSale = dateSale;
        this.materialName = materialName;
    }
}
