package com.appTest.bazar.dto.product;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
public class ProductUpdateDTO implements Serializable {
    private Long idProduct;
    private String name;
    private String brand;
    private Double price;
    private Double quantityAvailable;
}
