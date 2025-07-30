package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "orders")
@Getter @Setter
public class Orders {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idOrders;

    @Column(name = "date_create")
    private LocalDate dateCreate;

    @Column(name = "date_delivery")
    private LocalDate dateDelivery;

    @ManyToOne
    @JoinColumn(name = "client_id")
    private Client client;

    @OneToMany(mappedBy = "orders", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderDetail> orderDetails = new ArrayList<>();

    @OneToMany(mappedBy = "orders", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Delivery> deliveries = new ArrayList<>();

    @OneToMany(mappedBy = "orders")
    private List<Sale> sales = new ArrayList<>();

    public Orders() {}

    public Orders(Client client, LocalDate dateCreate, LocalDate dateDelivery) {
        this.client = client;
        this.dateCreate = dateCreate;
        this.dateDelivery = dateDelivery;
    }
}
