package com.appTest.store.dto.stock;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({"idStock", "nameWarehouse", "nameMaterial", "quantityAvailable", "lastUpdate"})
public class StockDTO implements Serializable {
    private Long idStock;
    private String nameWarehouse;
    private String nameMaterial;
    private BigDecimal quantityAvailable;
    private LocalDate lastUpdate;

    public StockDTO() {}

    public StockDTO(Long idStock, String nameMaterial, String nameWarehouse, BigDecimal quantityAvailable, LocalDate lastUpdate) {
        this.idStock = idStock;
        this.nameMaterial = nameMaterial;
        this.nameWarehouse = nameWarehouse;
        this.quantityAvailable = quantityAvailable;
        this.lastUpdate = lastUpdate;
    }
}
