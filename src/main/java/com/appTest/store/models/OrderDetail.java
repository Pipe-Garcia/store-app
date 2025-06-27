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
    private BigDecimal budget;

    @ManyToOne
    @JoinColumn(name = "order_id")
    private Order order;

    @ManyToOne
    @JoinColumn(name = "material_id")
    private Material material;

    public OrderDetail() {}

    public OrderDetail(BigDecimal budget, Material material, Order order) {
        this.budget = budget;
        this.material = material;
        this.order = order;
    }
}
