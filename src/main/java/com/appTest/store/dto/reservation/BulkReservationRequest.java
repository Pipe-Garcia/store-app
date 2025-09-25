package com.appTest.store.dto.reservation;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import java.util.List;

// La solicitud: un pedido (orderId) y varios ítems
public record BulkReservationRequest(
        @NotNull Long orderId,
        @NotEmpty List<@Valid BulkReservationItem> items
) {}
