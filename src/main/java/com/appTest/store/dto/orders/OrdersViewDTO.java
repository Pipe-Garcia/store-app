package com.appTest.store.dto.orders;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter @Setter
@NoArgsConstructor
@AllArgsConstructor
public class OrdersViewDTO implements Serializable {
    private Long idOrders;

    private Long clientId;
    private String clientName;

    private LocalDate dateCreate;
    private LocalDate dateDelivery;

    private BigDecimal total;          // suma de priceUni * quantityOrdered
    private Boolean soldOut;           // true si remainingTotal == 0
    private BigDecimal remainingUnits; // suma de remainingUnits de todas las líneas

    private List<OrderDetailViewDTO> details;
}

