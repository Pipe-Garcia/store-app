package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter
public class SaleDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idSaleDetail;

    @Column(nullable = false)
    private BigDecimal quantity = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal priceUni = BigDecimal.ZERO;

    @ManyToOne
    @JoinColumn(name = "sale_id", nullable = false)
    private Sale sale;

    @ManyToOne
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @OneToMany(mappedBy = "saleDetail", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DeliveryItem> deliveryItems = new ArrayList<>();

    public SaleDetail() {}

    public SaleDetail(BigDecimal quantity, BigDecimal priceUni, Sale sale, Material material) {
        this.quantity = quantity;
        this.priceUni = priceUni;
        this.sale = sale;
        this.material = material;
    }
}

