package com.appTest.store.models;

import com.appTest.store.listeners.AuditListener;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@EntityListeners(AuditListener.class)
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
