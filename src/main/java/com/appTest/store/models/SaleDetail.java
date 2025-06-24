package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Getter @Setter
public class SaleDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idSaleDetail;

    private Double quantity;
    private Double priceUni;

    @ManyToOne
    @JoinColumn(name = "sale_id")
    private Sale sale;

    @ManyToOne
    @JoinColumn(name = "material_id")
    private Material material;

    public SaleDetail() {}

    public SaleDetail(Double quantity, Double priceUni, Sale sale, Material material) {
        this.quantity = quantity;
        this.priceUni = priceUni;
        this.sale = sale;
        this.material = material;
    }
}
