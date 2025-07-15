package com.appTest.store.dto.stock;

import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
public class StockUpdateDTO implements Serializable {

    @NotNull(message = "Stock ID is required")
    private Long idStock;

    private BigDecimal quantityAvailable;
}
