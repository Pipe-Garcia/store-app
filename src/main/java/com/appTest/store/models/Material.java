package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter
public class Material {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idMaterial;

    private String name;
    private String brand;
    private BigDecimal priceArs;
    private BigDecimal priceUsd;
    private String measurementUnit;
    private String internalNumber;
    private String description;


    @Column(nullable = false, length = 20)
    private String status;

    @ManyToOne
    @JoinColumn(name = "family_id")
    private Family family;

    @OneToMany(mappedBy = "material")
    private List<OrderDetail> orderDetails = new ArrayList<>();

    @OneToMany(mappedBy = "material")
    private List<MaterialSupplier> materialSuppliers = new ArrayList<>();

    @OneToMany(mappedBy = "material", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Stock> stockList = new ArrayList<>();

    @OneToMany(mappedBy = "material")
    private List<SaleDetail> saleDetailList = new ArrayList<>();

    public Material() {
        this.status = "ACTIVE";
    }

    public Material(String brand,
                    Family family,
                    String internalNumber,
                    String measurementUnit,
                    String name,
                    BigDecimal priceArs,
                    BigDecimal priceUsd,
                    String description) {
        this.brand = brand;
        this.family = family;
        this.internalNumber = internalNumber;
        this.measurementUnit = measurementUnit;
        this.name = name;
        this.priceArs = priceArs;
        this.priceUsd = priceUsd;
        this.description = description;
        this.status = "ACTIVE";
    }
}
