package com.appTest.bazar.dto.productSale;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
public class ProductSaleRequestDTO implements Serializable {
    private Long productId;
    private Double quantity;
}
