package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Getter @Setter
public class PurchaseDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idPurchaseDetail;

    @ManyToOne
    @JoinColumn(name = "purchase_id", nullable = false)
    private Purchase purchase;

    @ManyToOne
    @JoinColumn(name = "material_supplier_id", nullable = false)
    private MaterialSupplier materialSupplier;

    @ManyToOne
    @JoinColumn(name = "warehouse_id")
    private Warehouse warehouse;

    @Column(nullable = false)
    private BigDecimal quantity;

    @Column(nullable = false)
    private BigDecimal purchasedPrice;

    public PurchaseDetail() {}

    public PurchaseDetail(Purchase purchase, MaterialSupplier materialSupplier, BigDecimal quantity) {
        this.purchase = purchase;
        this.materialSupplier = materialSupplier;
        this.quantity = quantity;
    }
}