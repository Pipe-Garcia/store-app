package com.appTest.store.models;

import com.appTest.store.models.enums.DocumentStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Getter @Setter
public class Purchase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idPurchase;

    private LocalDate datePurchase;

    @ManyToOne
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @OneToMany(mappedBy = "purchase", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseDetail> purchaseDetails = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DocumentStatus status = DocumentStatus.ACTIVE;

    public Purchase() {}

    public Purchase(LocalDate datePurchase, Supplier supplier) {
        this.datePurchase = datePurchase;
        this.supplier = supplier;
        this.status = DocumentStatus.ACTIVE;
    }
}