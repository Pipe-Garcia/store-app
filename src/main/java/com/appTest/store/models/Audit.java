package com.appTest.store.models;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Getter
@Setter
public class Audit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long idAudit;

    @Column(nullable = false)
    private String tableName; // Nombre de la tabla afectada (ej. "Sale", "Purchase")

    @Column(nullable = false)
    private Long recordId; // ID del registro modificado en la tabla afectada

    @Column(nullable = false)
    private String action; // Tipo de acción (INSERT, UPDATE, DELETE)

    @Column(nullable = false)
    private String changedBy; // Usuario o sistema que realizó el cambio

    @Column(nullable = false)
    private LocalDateTime changeDate; // Fecha y hora del cambio

    @Column(length = 1000) // Longitud ajustable según necesidades
    private String oldValue; // Valor anterior (opcional, en formato JSON o texto)

    @Column(length = 1000) // Longitud ajustable según necesidades
    private String newValue; // Nuevo valor (opcional, en formato JSON o texto)

    public Audit() {}

    public Audit(String tableName, Long recordId, String action, String changedBy, LocalDateTime changeDate, String oldValue, String newValue) {
        this.tableName = tableName;
        this.recordId = recordId;
        this.action = action;
        this.changedBy = changedBy;
        this.changeDate = changeDate;
        this.oldValue = oldValue;
        this.newValue = newValue;
    }
}
