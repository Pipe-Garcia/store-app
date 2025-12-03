package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_supplier_dni",   columnNames = "dni"),
                @UniqueConstraint(name = "uk_supplier_email", columnNames = "email")
        }
)
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

    public Supplier(String name, String surname, String dni, String email, String address, String locality, String nameCompany, String phoneNumber, String status) {
        this.name = name;
        this.surname = surname;
        this.dni = dni;
        this.email = email;
        this.address = address;
        this.locality = locality;
        this.nameCompany = nameCompany;
        this.phoneNumber = phoneNumber;
        this.status = status;
    }
}
