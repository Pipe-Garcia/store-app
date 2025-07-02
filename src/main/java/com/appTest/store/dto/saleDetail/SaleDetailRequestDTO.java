package com.appTest.store.dto.saleDetail;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
public class SaleDetailRequestDTO implements Serializable {
    private Long materialId;
    private BigDecimal quantity;
}
