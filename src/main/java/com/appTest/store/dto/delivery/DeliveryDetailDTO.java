// src/main/java/com/appTest/store/dto/delivery/DeliveryDetailDTO.java
package com.appTest.store.dto.delivery;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter @Setter
@JsonPropertyOrder({
        "idDelivery",
        "saleId",
        "ordersId",
        "deliveryDate",
        "status",
        "clientName",
        "total",
        "items"
})
public class DeliveryDetailDTO implements Serializable {

    private Long idDelivery;
    private Long saleId;      // 🔴 NUEVO: venta asociada a la entrega
    private Long ordersId;    // presupuesto de referencia (opcional)

    private LocalDate deliveryDate;
    private String status;
    private String clientName;

    private BigDecimal total;            // total de ESTA entrega
    private List<DeliveryItemDTO> items; // renglones

    public DeliveryDetailDTO() {}

    public DeliveryDetailDTO(Long idDelivery,
                             Long saleId,
                             Long ordersId,
                             LocalDate deliveryDate,
                             String status,
                             String clientName,
                             BigDecimal total,
                             List<DeliveryItemDTO> items) {
        this.idDelivery = idDelivery;
        this.saleId = saleId;
        this.ordersId = ordersId;
        this.deliveryDate = deliveryDate;
        this.status = status;
        this.clientName = clientName;
        this.total = total;
        this.items = items;
    }
}
