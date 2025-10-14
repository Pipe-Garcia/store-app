package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Getter @Setter
public class DeliveryItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idDeliveryItem;

    @ManyToOne(optional = false)
    @JoinColumn(name = "delivery_id")
    private Delivery delivery;

    @ManyToOne(optional = false)
    @JoinColumn(name = "order_detail_id")
    private OrderDetail orderDetail;

    @ManyToOne(optional = false)
    @JoinColumn(name = "material_id")
    private Material material; // redundante pero útil para reportes/joins

    @ManyToOne(optional = true)
    @JoinColumn(name = "warehouse_id")
    private Warehouse warehouse; // desde dónde se descuenta

    @Column(nullable = false)
    private BigDecimal quantityDelivered = BigDecimal.ZERO;

    @Column(nullable = true) // snapshot opcional
    private BigDecimal unitPriceSnapshot;

}
