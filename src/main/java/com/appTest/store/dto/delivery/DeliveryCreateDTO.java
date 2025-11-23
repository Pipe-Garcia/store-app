package com.appTest.store.dto.delivery;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;

@Getter
@Setter
public class DeliveryCreateDTO implements Serializable {

    @NotNull(message = "Delivery date is required")
    private LocalDate deliveryDate;

    /**
     * Opcional: si no viene, el servicio intenta derivarlo desde la venta
     * (sale.getOrders()). Se mantiene por compatibilidad y trazabilidad,
     * pero el flujo principal ahora es por saleId.
     */
    private Long ordersId;

    /**
     * ✅ Nuevo eje del modelo: la entrega nace desde la VENTA.
     */
    @NotNull(message = "Sale ID is required")
    private Long saleId;

    /**
     * Campo opcional, se ignora en create (el servicio recalcula).
     */
    private String status;

    @NotNull(message = "At least one delivery item is required")
    private java.util.List<DeliveryItemCreateDTO> items;
}
