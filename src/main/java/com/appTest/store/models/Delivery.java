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
    private String status;
    private LocalDate deliveryDate;

    @ManyToOne
    @JoinColumn(name = "order_id")
    private Orders orders;



    @OneToMany(mappedBy = "delivery", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Sale> sales = new ArrayList<>();

    public Delivery() {}

    public Delivery(LocalDate deliveryDate, Orders orders, String status) {
        this.deliveryDate = deliveryDate;
        this.orders = orders;
        this.status = status;
    }
}
