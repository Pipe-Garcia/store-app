package com.appTest.store.dto.stock;

import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter
@Setter
@AllArgsConstructor
public class StockByWarehouseDTO implements Serializable {
    private Long warehouseId;
    private String warehouseName;
    private BigDecimal quantityAvailable;
}
