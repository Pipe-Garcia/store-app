package com.appTest.store.models;

import com.appTest.store.models.enums.ReservationStatus;
import jakarta.persistence.*;
import lombok.Getter; import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity @Getter @Setter
public class StockReservation {

    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idReservation;

    @ManyToOne(optional = false) 
    @JoinColumn(name = "material_id")
    private Material material;
    
    @ManyToOne(optional = false) 
    @JoinColumn(name = "warehouse_id")
    private Warehouse warehouse;

    // Podés asociarla al pedido, a la venta, o a ambos; dejo Order como base:
    @ManyToOne(optional = true)
    @JoinColumn(name = "order_id", nullable = true) // ← importante
    private Orders orders;

    @ManyToOne
    @JoinColumn(name = "client_id")
    private Client client;

    @Column(nullable = false)
    private BigDecimal quantity;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 20, nullable = false)
    private ReservationStatus status;

    private LocalDate reservedAt = LocalDate.now();

    private LocalDate expiresAt; // opcional

}

