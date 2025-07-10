package com.appTest.store.dto.client;

import com.appTest.store.dto.orders.OrdersDTO;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
@JsonPropertyOrder({ "idClient", "name", "surname", "dni", "email", "address", "locality", "phoneNumber", "latestOrder", "quantSales" })
public class ClientDTO implements Serializable {
    private Long idClient;
    private String name;
    private String surname;
    private String dni;
    private String email;
    private String address;
    private String locality;
    private String phoneNumber;
    private OrdersDTO latestOrder;
    private int quantSales;

    public ClientDTO() {}
    public ClientDTO( Long idClient, String name, String surname, int quantSales, String dni, String email, String address, String locality, String phoneNumber, OrdersDTO latestOrder) {
        this.idClient = idClient;
        this.name = name;
        this.surname = surname;
        this.dni = dni;
        this.quantSales = quantSales;
        this.email = email;
        this.address = address;
        this.locality = locality;
        this.phoneNumber = phoneNumber;
        this.latestOrder = latestOrder;
    }
}

