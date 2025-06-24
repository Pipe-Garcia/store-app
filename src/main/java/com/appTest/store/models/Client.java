package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
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

    public Client () {}

    public Client(String address, String dni, String email, Long idClient, String locality, String name, Long phoneNumber, List<Sale> sales, String surname) {
        this.address = address;
        this.dni = dni;
        this.email = email;
        this.idClient = idClient;
        this.locality = locality;
        this.name = name;
        this.phoneNumber = phoneNumber;
        this.sales = sales;
        this.surname = surname;
    }
}
