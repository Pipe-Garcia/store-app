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
    private String phoneNumber;
    private String status;

    @OneToMany(mappedBy = "client")
    private List<Sale> sales = new ArrayList<>();

    @OneToMany(mappedBy = "client")
    private List<Orders> orders = new ArrayList<>();

    public Client () {}

    public Client(String address, String dni, String email, String locality, String name, String phoneNumber, String surname, String status) {
        this.address = address;
        this.dni = dni;
        this.email = email;
        this.locality = locality;
        this.name = name;
        this.phoneNumber = phoneNumber;
        this.surname = surname;
        this.status = status;
    }
}
