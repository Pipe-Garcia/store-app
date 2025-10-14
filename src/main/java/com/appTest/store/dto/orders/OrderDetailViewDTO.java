package com.appTest.store.dto.orders;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrderDetailViewDTO implements Serializable {
    private Long idOrderDetail;
    private Long materialId;
    private String materialName;
    private BigDecimal priceUni;

    private BigDecimal quantityOrdered;   // pedidas
    private BigDecimal quantityCommitted; // = ALLOCATED (vendidas/comprometidas)
    private BigDecimal quantityDelivered; // = sum(DeliveryItem)
    private BigDecimal remainingUnits;    // pedidas - consumidas

}


