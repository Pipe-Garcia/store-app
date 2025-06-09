package com.appTest.bazar.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.List;

@Entity
@Getter @Setter
public class Sale {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idSale;
    private LocalDate dateSale;
    private Double total;

    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<ProductSale> productSaleList;

    @ManyToOne
    @JoinColumn(name = "client_id")
    private Client client;

    public Sale () {}

    public Sale(Client client, Long idSale, LocalDate dateSale, List<ProductSale> productSaleList, Double total) {
        this.client = client;
        this.idSale = idSale;
        this.dateSale = dateSale;
        this.productSaleList = productSaleList;
        this.total = total;
    }
}
