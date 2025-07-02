package com.appTest.store.dto.client;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
@JsonPropertyOrder({ "name", "surname", "dni", "email", "address", "locality", "phoneNumber","quantSales" })
public class ClientDTO implements Serializable {
    private String name;
    private String surname;
    private String dni;
    private String email;
    private String address;
    private String locality;
    private String phoneNumber;
    private int quantSales;

    public ClientDTO() {}
    public ClientDTO(String name, String surname, int quantSales, String dni, String email, String address, String locality, String phoneNumber) {
        this.name = name;
        this.surname = surname;
        this.dni = dni;
        this.quantSales = quantSales;
        this.email = email;
        this.address = address;
        this.locality = locality;
        this.phoneNumber = phoneNumber;
    }
}

