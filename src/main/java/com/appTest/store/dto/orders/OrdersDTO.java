package com.appTest.store.dto.orders;


import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
public class OrdersDTO implements Serializable {
    private Long idOrders;
    private LocalDate dateCreate;
    private LocalDate dateDelivery;
    private String clientName;
    private Long clientId;
    private BigDecimal total;
    private Boolean soldOut;

    public OrdersDTO() {}

    public OrdersDTO(Long idOrders, String clientName, Long clientId,
                     LocalDate dateCreate, LocalDate dateDelivery,
                     Boolean soldOut, BigDecimal total)
    {
        this.idOrders = idOrders;
        this.clientName = clientName;
        this.clientId = clientId;
        this.dateCreate = dateCreate;
        this.dateDelivery = dateDelivery;
        this.soldOut = soldOut;
        this.total = total;
    }
}
