package com.appTest.store.models;

import com.appTest.store.listeners.AuditListener;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@EntityListeners(AuditListener.class)
@Getter @Setter
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idOrder;
    private LocalDate dateCreate;
    private LocalDate dateDelivery;

    @ManyToOne
    @JoinColumn(name = "client_id")
    private Client client;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OrderDetail> orderDetails = new ArrayList<>();

    @OneToMany(mappedBy = "order")
    private List<Sale> sales = new ArrayList<>();

    public Order() {}

    public Order(Client client, LocalDate dateCreate, LocalDate dateDelivery) {
        this.client = client;
        this.dateCreate = dateCreate;
        this.dateDelivery = dateDelivery;
    }
}
