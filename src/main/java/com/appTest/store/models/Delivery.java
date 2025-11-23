package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter
public class Delivery {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idDelivery;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private com.appTest.store.models.enums.DeliveryStatus status;

    private LocalDate deliveryDate;

    @ManyToOne
    @JoinColumn(name = "order_id", referencedColumnName = "idOrders")
    private Orders orders;

    @ManyToOne(optional = false)
    @JoinColumn(name = "sale_id")
    private Sale sale;

    @OneToMany(mappedBy = "delivery", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<DeliveryItem> items = new ArrayList<>();

    public Delivery() {}

    public Delivery(LocalDate deliveryDate,
                    Orders orders,
                    Sale sale,
                    com.appTest.store.models.enums.DeliveryStatus status) {
        this.deliveryDate = deliveryDate;
        this.orders = orders;
        this.sale = sale;
        this.status = status;
    }
}
