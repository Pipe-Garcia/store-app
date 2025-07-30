package com.appTest.store.dto.stock;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
@JsonPropertyOrder({"idStock", "idMaterial", "nameMaterial", "nameWarehouse", "quantityAvailable", "lastUpdate"})
public class StockDTO implements Serializable {
    private Long idStock;
    private Long idMaterial;
    private String nameMaterial;
    private String nameWarehouse;
    private BigDecimal quantityAvailable;
    private LocalDate lastUpdate;

    public StockDTO() {}


    public StockDTO(Long idStock, Long idMaterial, String nameMaterial, String nameWarehouse, BigDecimal quantityAvailable, LocalDate lastUpdate) {
        this.idStock = idStock;
        this.idMaterial = idMaterial;
        this.nameMaterial = nameMaterial;
        this.nameWarehouse = nameWarehouse;
        this.quantityAvailable = quantityAvailable;
        this.lastUpdate = lastUpdate;
    }


}
