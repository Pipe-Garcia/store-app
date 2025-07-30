package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity

@Getter @Setter
public class Supplier {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idSupplier;
    private String name;
    private String surname;
    private String dni;
    private String email;
    private String address;
    private String locality;
    private String nameCompany;
    private String status;
    private String phoneNumber;

    @OneToMany(mappedBy = "supplier")
    private List<MaterialSupplier> materialSuppliers = new ArrayList<>();

    @OneToMany(mappedBy = "supplier")
    private List<Purchase> purchases = new ArrayList<>();

    public Supplier() {}

    public Supplier(String address, String dni, String email, String locality, String name, String nameCompany, String phoneNumber, String surname, String status) {
        this.address = address;
        this.dni = dni;
        this.email = email;
        this.locality = locality;
        this.name = name;
        this.nameCompany = nameCompany;
        this.phoneNumber = phoneNumber;
        this.surname = surname;
        this.status = status;
    }
}
