package com.appTest.store.dto.delivery;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;

@Getter @Setter
public class DeliveryCreateDTO implements Serializable {

    @NotNull(message = "Delivery date is required")
    private LocalDate deliveryDate;

    @NotNull(message = "Order ID is required")
    private Long ordersId;

    // NUEVO 👇 (opcional en el payload)
    private Long saleId;

    private String status; // opcional, si se envía lo ignoramos y calculamos

    @NotNull
    private java.util.List<DeliveryItemCreateDTO> items;
}

