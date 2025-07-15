package com.appTest.store.dto.orders;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;

@Getter @Setter
public class OrdersUpdateDTO implements Serializable {

    @NotNull(message = "Order ID is required")
    @DecimalMin(value = "1.0", message = "Order ID must be positive")
    private Long idOrders;

    private LocalDate dateCreate;

    private LocalDate dateDelivery;

    private Long clientId;
}
