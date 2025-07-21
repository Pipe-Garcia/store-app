package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Getter @Setter
public class OrderDetail {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idOrderDetail;

    @Column(nullable = false)
    private BigDecimal quantity = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal priceUni = BigDecimal.ZERO;

    @ManyToOne
    @JoinColumn(name = "order_id", referencedColumnName = "idOrders")
    private Orders orders;

    @ManyToOne
    @JoinColumn(name = "material_id")
    private Material material;

    public OrderDetail() {}

    public OrderDetail(Material material, Orders orders, BigDecimal quantity, BigDecimal priceUni) {
        this.material = material;
        this.orders = orders;
        this.quantity = quantity;
        this.priceUni = priceUni;
    }
}
