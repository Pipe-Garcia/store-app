package com.appTest.store.dto.orders;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({ "idOrders", "clientName", "dateCreate", "dateDelivery", "total"})
public class OrdersDTO implements Serializable {
    private Long idOrders;
    private LocalDate dateCreate;
    private LocalDate dateDelivery;
    private String clientName;
    private BigDecimal total;

    public OrdersDTO() {}

    public OrdersDTO(Long idOrders, String clientName, LocalDate dateCreate, LocalDate dateDelivery, BigDecimal total) {
        this.idOrders = idOrders;
        this.clientName = clientName;
        this.dateCreate = dateCreate;
        this.dateDelivery = dateDelivery;
        this.total = total;
    }
}
