package com.appTest.store.dto.sale;

import com.appTest.store.dto.payment.PaymentCreateDTO;
import com.appTest.store.dto.saleDetail.SaleDetailRequestDTO;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.List;

@Getter @Setter
public class SaleCreateDTO implements Serializable {
    @NotNull(message = "Date sale is required")
    private LocalDate dateSale;

    @NotNull(message = "Client ID is required")
    private Long clientId;

    @NotNull(message = "Materials are required")
    private List<SaleDetailRequestDTO> materials;

    private Long deliveryId;

    private PaymentCreateDTO payment;
}
