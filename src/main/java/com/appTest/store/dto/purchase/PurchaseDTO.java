package com.appTest.store.dto.purchase;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({ "idPurchase", "datePurchase", "supplierName", "totalAmount" })
public class PurchaseDTO implements Serializable {
    private Long idPurchase;
    private LocalDate datePurchase;
    private String supplierName;
    private BigDecimal totalAmount;

    public PurchaseDTO() {}

    public PurchaseDTO(Long idPurchase, LocalDate datePurchase, String supplierName, BigDecimal totalAmount) {
        this.idPurchase = idPurchase;
        this.datePurchase = datePurchase;
        this.supplierName = supplierName;
        this.totalAmount = totalAmount;
    }
}
