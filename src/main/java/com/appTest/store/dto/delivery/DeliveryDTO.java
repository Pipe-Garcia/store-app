package com.appTest.store.dto.delivery;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({"idDelivery", "ordersId", "deliveryDate", "status", "clientName"})
public class DeliveryDTO implements Serializable {

    private Long idDelivery;
    private LocalDate deliveryDate;
    private String status;
    private String clientName;
    private Long ordersId;

    public DeliveryDTO() {}

    public DeliveryDTO(Long idDelivery, Long ordersId, LocalDate deliveryDate, String status, String clientName) {
        this.idDelivery = idDelivery;
        this.ordersId = ordersId;
        this.deliveryDate = deliveryDate;
        this.status = status;
        this.clientName = clientName;
    }
}
