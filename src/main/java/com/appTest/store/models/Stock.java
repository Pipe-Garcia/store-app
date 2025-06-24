package com.appTest.store.models;

import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Getter @Setter
public class Stock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idStock;
    @Column(nullable = false)
    @DecimalMin(value = "0.0")
    private BigDecimal quantityAvailable = BigDecimal.ZERO;

    @ManyToOne
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @ManyToOne
    @JoinColumn(name = "warehouse_id", nullable = false)
    private Warehouse warehouse;

    public Stock() {}

    public Stock(Material material, BigDecimal quantityAvailable, Warehouse warehouse) {
        this.material = material;
        this.quantityAvailable = quantityAvailable;
        this.warehouse = warehouse;
    }
}
