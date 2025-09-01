package com.appTest.store.dto.delivery;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter; import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter @Setter
@JsonPropertyOrder({"idDelivery","ordersId","deliveryDate","status","clientName","total","items"})
public class DeliveryDetailDTO implements Serializable {
    private Long idDelivery;
    private Long ordersId;
    private LocalDate deliveryDate;
    private String status;
    private String clientName;
    private BigDecimal total;                  // total de ESTA entrega
    private List<DeliveryItemDTO> items;       // renglones

    public DeliveryDetailDTO(Long idDelivery, Long ordersId, LocalDate deliveryDate,
                             String status, String clientName, BigDecimal total,
                             List<DeliveryItemDTO> items) {
        this.idDelivery = idDelivery;
        this.ordersId = ordersId;
        this.deliveryDate = deliveryDate;
        this.status = status;
        this.clientName = clientName;
        this.total = total;
        this.items = items;
    }
}
