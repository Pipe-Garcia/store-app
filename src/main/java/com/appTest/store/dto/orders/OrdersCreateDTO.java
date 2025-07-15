package com.appTest.store.dto.orders;

import com.appTest.store.dto.orderDetail.OrderDetailRequestDTO;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.List;

@Getter @Setter
public class OrdersCreateDTO implements Serializable {

    @NotNull(message = "Create date is required")
    private LocalDate dateCreate;

    @NotNull(message = "Delivery date is required")
    private LocalDate dateDelivery;

    @NotNull(message = "Client ID is required")
    private Long clientId;

    @NotNull(message = "Materials are required")
    private List<OrderDetailRequestDTO> materials;
}
