package com.appTest.store.dto.material;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter
@JsonPropertyOrder({ "name", "brand", "priceArs", "quantityAvailable", "totalSales", "stockCount", "supplierCount", "saleDetailCount", "orderDetailCount" })
public class MaterialDTO implements Serializable {
    private String name;
    private String brand;
    private BigDecimal priceArs; // Asumimos priceArs como principal
    private BigDecimal quantityAvailable; // Total de Stock
    private int totalSales; // Total de ventas (ajustaremos la lógica)
    private int stockCount; // Cantidad de Stock asociados
    private int supplierCount; // Cantidad de MaterialSuppliers
    private int saleDetailCount; // Cantidad de SaleDetails
    private int orderDetailCount; // Cantidad de OrderDetails

    public MaterialDTO() {}

    public MaterialDTO(String brand, String name, BigDecimal priceArs, BigDecimal quantityAvailable, int totalSales,
                       int stockCount, int supplierCount, int saleDetailCount, int orderDetailCount) {
        this.name = name;
        this.brand = brand;
        this.priceArs = priceArs;
        this.quantityAvailable = quantityAvailable;
        this.totalSales = totalSales;
        this.stockCount = stockCount;
        this.supplierCount = supplierCount;
        this.saleDetailCount = saleDetailCount;
        this.orderDetailCount = orderDetailCount;
    }
}
