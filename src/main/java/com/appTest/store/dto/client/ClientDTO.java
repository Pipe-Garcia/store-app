package com.appTest.store.dto.client;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
                                                                                                        // , "latestOrderId"
@JsonPropertyOrder({ "name", "surname", "dni", "email", "address", "locality", "phoneNumber", "quantSales"})
public class ClientDTO implements Serializable {
    private String name;
    private String surname;
    private String dni;
    private String email;
    private String address;
    private String locality;
    private Long phoneNumber;
    private int quantSales;
    // private Long latestOrderId; Último pedido asociado

    public ClientDTO() {}
                                                                                                                                            // , Long latestOrderId
    public ClientDTO(String address, String dni, String email, String locality, String name, Long phoneNumber, int quantSales, String surname) {
        this.address = address;
        this.dni = dni;
        this.email = email;
        this.locality = locality;
        this.name = name;
        this.phoneNumber = phoneNumber;
        this.quantSales = quantSales;
        this.surname = surname;
        // this.latestOrderId = latestOrderId;
    }
}

