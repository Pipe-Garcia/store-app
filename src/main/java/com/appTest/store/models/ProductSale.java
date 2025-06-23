package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter @Setter
public class ProductSale {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idProductSale;

    private Double quantity;
    private Double priceUni;

    @ManyToOne
    @JoinColumn(name = "sale_id")
    private Sale sale;

    @ManyToOne
    @JoinColumn(name = "product_id")
    private Product product;

    public ProductSale() {}

    public ProductSale(Long idProductSale, Double quantity, Double priceUni, Sale sale, Product product) {
        this.idProductSale = idProductSale;
        this.quantity = quantity;
        this.priceUni = priceUni;
        this.sale = sale;
        this.product = product;
    }
}
