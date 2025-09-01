package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter
@Setter
public class MaterialSupplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idMaterialSupplier;

    @ManyToOne
    @JoinColumn(name = "material_id", nullable = false)
    private Material material;

    @ManyToOne
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @OneToMany(mappedBy = "materialSupplier", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseDetail> purchaseDetails = new ArrayList<>();

    @Column(nullable = false)
    private BigDecimal priceUnit = BigDecimal.ZERO;

    @Column(nullable = false)
    private Integer deliveryTimeDays = 0;

    public MaterialSupplier() {}

    public MaterialSupplier(Integer deliveryTimeDays, Material material, BigDecimal priceUnit, Supplier supplier) {
        this.deliveryTimeDays = deliveryTimeDays;
        this.material = material;
        this.priceUnit = priceUnit;
        this.supplier = supplier;
    }

    // 🔧 Métodos requeridos por el SupplierService
    public void setUnitPrice(BigDecimal unitPrice) {
        this.priceUnit = unitPrice;
    }

    public void setEstimatedDeliveryTime(Integer estimatedDeliveryTime) {
        this.deliveryTimeDays = estimatedDeliveryTime;
    }
}
