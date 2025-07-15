package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity

@Getter @Setter
public class Family {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idFamily;
    private String typeFamily;

    @OneToMany(mappedBy = "family")
    private List<Material> materials = new ArrayList<>();

    public Family() {}

    public Family( String typeFamily) {
        this.typeFamily = typeFamily;
    }
}
