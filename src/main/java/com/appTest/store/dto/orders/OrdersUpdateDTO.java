package com.appTest.store.dto.orders;

import com.appTest.store.dto.orderDetail.OrderDetailUpsertDTO;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.List;

@Getter @Setter
public class OrdersUpdateDTO implements Serializable {

    @NotNull(message = "Order ID is required")
    @DecimalMin(value = "1.0", message = "Order ID must be positive")
    private Long idOrders;

    // Si NO querés permitir cambiar dateCreate, podés ignorarlo en service
    private LocalDate dateCreate;
    private LocalDate dateDelivery;

    // opcional: permitir cambio de cliente
    private Long clientId;

    // NUEVO: estado deseado de los renglones
    private List<OrderDetailUpsertDTO> details;

    // NUEVO: si true, borra los renglones que no vengan en "details"
    private boolean deleteMissingDetails = true;
}
