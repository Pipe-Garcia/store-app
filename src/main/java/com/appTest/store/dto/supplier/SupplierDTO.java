package com.appTest.store.dto.supplier;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@JsonPropertyOrder({ "idSupplier", "name", "surname", "dni", "email", "address", "locality", "nameCompany", "status", "phoneNumber", "quantPurchases" })
public class SupplierDTO implements Serializable {
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
    private int quantPurchases;

    public SupplierDTO() {}

    public SupplierDTO(Long idSupplier, String name, String surname, String dni, String email, String address, String locality,
                       String nameCompany, String status, String phoneNumber, int quantPurchases) {
        this.idSupplier = idSupplier;
        this.name = name;
        this.surname = surname;
        this.dni = dni;
        this.email = email;
        this.address = address;
        this.locality = locality;
        this.nameCompany = nameCompany;
        this.status = status;
        this.phoneNumber = phoneNumber;
        this.quantPurchases = quantPurchases;
    }
}
