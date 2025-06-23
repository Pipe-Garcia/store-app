package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

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

    @OneToMany(mappedBy = "client")
    private List<Sale> sales;

    public Client () {}

    public Client(String dni, Long idClient, String name, List<Sale> sales, String surname) {
        this.dni = dni;
        this.idClient = idClient;
        this.name = name;
        this.sales = sales;
        this.surname = surname;
    }
}
