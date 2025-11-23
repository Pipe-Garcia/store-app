// src/main/java/com/appTest/store/models/Sale.java
package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter
public class Sale {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idSale;

    private LocalDate dateSale;

    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SaleDetail> saleDetailList = new ArrayList<>();

    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Payment> paymentList = new ArrayList<>();

    @ManyToOne
    @JoinColumn(name = "order_id", referencedColumnName = "idOrders")
    private Orders orders;

    // 🔴 nueva relación 1 (venta) -> N (entregas)
    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Delivery> deliveries = new ArrayList<>();

    @ManyToOne
    @JoinColumn(name = "client_id")
    private Client client;

    public Sale () {}

    public Sale(Client client, LocalDate dateSale, Orders orders) {
        this.client = client;
        this.dateSale = dateSale;
        this.orders = orders;
    }
}
