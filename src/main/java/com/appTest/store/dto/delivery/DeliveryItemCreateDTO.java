package com.appTest.store.dto.delivery;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter
@Setter
public class DeliveryItemCreateDTO implements Serializable {

    /**
     * Para el flujo nuevo basado en venta.
     * Hoy no lo usamos en el servicio, pero lo dejamos listo por si
     * en el futuro querés linkear DeliveryItem <- SaleDetail.
     */
    private Long saleDetailId;

    /**
     * Para compatibilidad con el modelo viejo (por pedido). Deja de ser
     * obligatorio: si viene, se usa; si no, se infiere por material.
     */
    private Long orderDetailId;

    @NotNull
    private Long materialId;

    /**
     * Depósito desde donde se retiran las unidades. Puede ser null si
     * tu lógica lo permite.
     */
    private Long warehouseId;

    /**
     * Cantidad a entregar. El front hoy manda "quantity", así que usamos
     * @JsonAlias para aceptar tanto "quantity" como "quantityDelivered".
     */
    @NotNull
    @DecimalMin("0.0001")
    @JsonAlias({"quantity", "quantityDelivered"})
    private BigDecimal quantityDelivered;
}
