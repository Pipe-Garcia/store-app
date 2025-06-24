package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

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
    private Double priceArs;
    private Double priceUsd;
    private Double measurementUnit;
    private Long internalNumber;

    @ManyToOne
    @JoinColumn(name = "family_id")
    private Family family;

    @OneToMany(mappedBy = "material")
    private List<Stock> stockList = new ArrayList<>();

    @OneToMany(mappedBy = "material")
    private List<SaleDetail> saleDetailList = new ArrayList<>();

    public Material() {}

    public Material(String brand, Family family, Long internalNumber, Double measurementUnit, String name, Double priceArs, Double priceUsd) {
        this.brand = brand;
        this.family = family;
        this.internalNumber = internalNumber;
        this.measurementUnit = measurementUnit;
        this.name = name;
        this.priceArs = priceArs;
        this.priceUsd = priceUsd;
    }
}
