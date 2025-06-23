package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Entity
@Getter @Setter
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idProduct;
    private String name;
    private String brand;
    private Double price;
    private Double quantityAvailable;

    @OneToMany(mappedBy = "product")
    private List<ProductSale>  productSaleList;

    public Product() {}

    public Product(String brand, Long idProduct, String name, Double price, List<ProductSale> productSaleList, Double quantityAvailable) {
        this.brand = brand;
        this.idProduct = idProduct;
        this.name = name;
        this.price = price;
        this.productSaleList = productSaleList;
        this.quantityAvailable = quantityAvailable;
    }
}
