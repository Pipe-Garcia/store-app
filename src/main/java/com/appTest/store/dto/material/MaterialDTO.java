package com.appTest.store.dto.material;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter
@Setter
@JsonPropertyOrder({
        "idMaterial", "name", "brand",
        "priceArs", "priceUsd",
        "measurementUnit", "internalNumber", "description",
        // familia
        "familyId", "familyName", "category",
        // agregados/calculados
        "quantityAvailable", "totalSales",
        "stockCount", "supplierCount", "saleDetailCount", "orderDetailCount"
})
public class MaterialDTO implements Serializable {

    private Long idMaterial;
    private String name;
    private String brand;
    private BigDecimal priceArs;
    private BigDecimal priceUsd;
    private String measurementUnit;
    private String internalNumber;
    private String description;

    // 🔹 NUEVO: datos de familia para poder preseleccionar en el front
    private Long familyId;
    private String familyName;

    // (lo que ya tenías)
    private String category;

    private BigDecimal quantityAvailable;
    private int totalSales;
    private int stockCount;
    private int supplierCount;
    private int saleDetailCount;
    private int orderDetailCount;

    public MaterialDTO() {}

    public MaterialDTO(
            Long idMaterial, String name, String brand,
            BigDecimal priceArs, BigDecimal priceUsd,
            String measurementUnit, String internalNumber, String description,
            // familia
            Long familyId, String familyName, String category,
            // agregados/calculados
            BigDecimal quantityAvailable, int totalSales,
            int stockCount, int supplierCount, int saleDetailCount, int orderDetailCount
    ) {
        this.idMaterial = idMaterial;
        this.name = name;
        this.brand = brand;
        this.priceArs = priceArs;
        this.priceUsd = priceUsd;
        this.measurementUnit = measurementUnit;
        this.internalNumber = internalNumber;
        this.description = description;

        this.familyId = familyId;
        this.familyName = familyName;
        this.category = category;

        this.quantityAvailable = quantityAvailable;
        this.totalSales = totalSales;
        this.stockCount = stockCount;
        this.supplierCount = supplierCount;
        this.saleDetailCount = saleDetailCount;
        this.orderDetailCount = orderDetailCount;
    }
}
