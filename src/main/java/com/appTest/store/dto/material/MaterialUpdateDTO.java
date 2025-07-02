package com.appTest.store.dto.material;

import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter
@Setter
public class MaterialUpdateDTO implements Serializable {
    private Long idMaterial;
    private String name;
    private String brand;
    private BigDecimal price;
    private BigDecimal quantityAvailable;
}
