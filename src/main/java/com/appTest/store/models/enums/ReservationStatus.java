package com.appTest.store.models.enums;

public enum ReservationStatus {
    ACTIVE,      // reserva previa (pedido)
    ALLOCATED,   // comprometido por venta (bloquea disponibilidad)
    CONSUMED,    // entregado (impacta stock físico)
    CANCELLED,
    EXPIRED
}
