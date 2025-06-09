package com.appTest.bazar.dto.sale;

import com.appTest.bazar.dto.productSale.ProductSaleRequestDTO;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.time.LocalDate;
import java.util.List;

@Getter @Setter
public class SaleCreateDTO implements Serializable {

    @NotNull(message = "Sale date is required")
    private LocalDate dateSale;

    @NotNull(message = "Client ID is required")
    private Long clientId;

    private List<ProductSaleRequestDTO> products;
}
