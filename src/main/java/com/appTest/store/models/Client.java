package com.appTest.store.models;

import com.appTest.store.listeners.AuditListener;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@EntityListeners(AuditListener.class)
@Getter @Setter
public class Client {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idClient;
    private String name;
    private String surname;
    private String dni;
    private String email;
    private String address;
    private String locality;
    private Long phoneNumber;

    @OneToMany(mappedBy = "client")
    private List<Sale> sales = new ArrayList<>();

    @OneToMany(mappedBy = "client")
    private List<Order> orders = new ArrayList<>();

    public Client () {}

    public Client(String address, String dni, String email, String locality, String name, Long phoneNumber, String surname) {
        this.address = address;
        this.dni = dni;
        this.email = email;
        this.locality = locality;
        this.name = name;
        this.phoneNumber = phoneNumber;
        this.surname = surname;
    }
}
