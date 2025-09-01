package com.appTest.store.dto.delivery;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;

@Getter @Setter
public class DeliveryUpdateDTO implements Serializable {

    @NotNull(message = "Delivery ID is required")
    private Long idDelivery;

    private LocalDate deliveryDate;

    private String status; // opcional, el servicio recalcula

    private java.util.List<DeliveryItemUpsertDTO> items;

    private boolean deleteMissingItems; // si true → borra renglones no enviados (solo OWNER)
}

