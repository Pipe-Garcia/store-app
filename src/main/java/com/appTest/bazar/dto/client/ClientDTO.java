package com.appTest.bazar.dto.client;

import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter @Setter
@JsonPropertyOrder({ "name", "surname", "dni", "quantSales" })
public class ClientDTO implements Serializable {
    private String name;
    private String surname;
    private String dni;
    private int quantSales;

    public ClientDTO() {}
    public ClientDTO(String name, String surname, int quantSales, String dni) {
        this.name = name;
        this.surname = surname;
        this.dni = dni;
        this.quantSales = quantSales;
    }
}

