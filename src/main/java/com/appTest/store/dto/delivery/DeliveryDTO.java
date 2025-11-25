// src/main/java/com/appTest/store/dto/delivery/DeliveryDTO.java
package com.appTest.store.dto.delivery;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({
        "idDelivery",
        "saleId",
        "ordersId",
        "deliveryDate",
        "status",
        "clientName",
        "deliveredUnits",
        "itemsSummary"
})
public class DeliveryDTO implements Serializable {

    private Long idDelivery;

    // id de la venta asociada (si existe)
    private Long saleId;

    // referencia al presupuesto (pedido)
    private Long ordersId;

    private LocalDate deliveryDate;
    private String status;
    private String clientName;

    // total de unidades entregadas en ESTA entrega
    private BigDecimal deliveredUnits;

    // NUEVO: resumen amigable de materiales entregados
    // Ej: "Regador automático - 1 unidad"
    private String itemsSummary;

    public DeliveryDTO() {}

    public DeliveryDTO(Long idDelivery,
                       Long ordersId,
                       LocalDate deliveryDate,
                       String status,
                       String clientName) {
        this.idDelivery = idDelivery;
        this.ordersId = ordersId;
        this.deliveryDate = deliveryDate;
        this.status = status;
        this.clientName = clientName;
    }

    public DeliveryDTO(Long idDelivery,
                       Long saleId,
                       Long ordersId,
                       LocalDate deliveryDate,
                       String status,
                       String clientName) {
        this.idDelivery = idDelivery;
        this.saleId = saleId;
        this.ordersId = ordersId;
        this.deliveryDate = deliveryDate;
        this.status = status;
        this.clientName = clientName;
    }
}

