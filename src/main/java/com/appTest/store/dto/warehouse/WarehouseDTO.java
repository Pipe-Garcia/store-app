package com.appTest.store.dto.warehouse;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
@JsonPropertyOrder({"idWarehouse", "address", "name", "location", "totalStock"})
public class WarehouseDTO implements Serializable {
    private Long idWarehouse;
    private String address;
    private String name;
    private String location;
    private BigDecimal totalStock;

    public WarehouseDTO() {}

    public WarehouseDTO(Long idWarehouse, String address, String location, String name, BigDecimal totalStock) {
        this.idWarehouse = idWarehouse;
        this.address = address;
        this.location = location;
        this.name = name;
        this.totalStock = totalStock;
    }
}
