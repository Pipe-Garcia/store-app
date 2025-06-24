package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter
public class Warehouse {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idWarehouse;
    private String address;
    private String name;
    private String location;

    @OneToMany(mappedBy = "warehouse")
    private List<Stock> stockList = new ArrayList<>();

    public Warehouse() {}

    public Warehouse(String address, String name, String location) {
        this.address = address;
        this.name = name;
        this.location = location;
    }
}
