package com.appTest.store.dto.delivery;

import com.appTest.store.dto.saleDetail.SaleDetailDTO;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.List;

@Getter @Setter
@JsonPropertyOrder({"idDelivery", "deliveryDate", "status", "clientName", "saleDetails"})
public class DeliveryDTO implements Serializable {

    private Long idDelivery;
    private LocalDate deliveryDate;
    private String status;
    private String clientName;
    private List<SaleDetailDTO> saleDetails;

    public DeliveryDTO() {}

    public DeliveryDTO(Long idDelivery, LocalDate deliveryDate, String status, String clientName, List<SaleDetailDTO> saleDetails) {
        this.idDelivery = idDelivery;
        this.deliveryDate = deliveryDate;
        this.status = status;
        this.clientName = clientName;
        this.saleDetails = saleDetails;
    }
}
