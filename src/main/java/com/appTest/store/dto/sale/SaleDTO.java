package com.appTest.store.dto.sale;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({ "idSale", "dateSale", "total", "clientName", "deliveryId", "deliveryDate", "paymentMethod" })
public class SaleDTO implements Serializable {
    private Long idSale;
    private LocalDate dateSale;
    private BigDecimal total;
    private String clientName;
    private Long deliveryId;
    private String paymentMethod;

    public SaleDTO() {}

    public SaleDTO( Long idSale, String clientName, LocalDate dateSale, BigDecimal total, String paymentMethod, Long deliveryId) {
        this.idSale = idSale;
        this.dateSale = dateSale;
        this.total = total;
        this.clientName = clientName;
        this.paymentMethod = paymentMethod;
        this.deliveryId = deliveryId;
    }
}
