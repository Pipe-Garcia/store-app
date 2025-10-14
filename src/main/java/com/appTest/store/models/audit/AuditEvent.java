package com.appTest.store.models.audit;

import jakarta.persistence.*;
import lombok.Getter; import lombok.Setter;

import java.time.LocalDateTime;

@Entity @Getter @Setter
public class AuditEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable=false) private LocalDateTime timestamp;
    private Long   actorId;
    @Column(nullable=false, length=200) private String actorName;
    private String roles;
    private String ip;
    private String userAgent;
    private String requestId;

    @Column(nullable=false, length=80)  private String action;
    @Column(nullable=false, length=120) private String entity;
    private Long entityId;

    @Column(nullable=false, length=20)  private String status; // SUCCESS | FAIL
    @Column(length=500) private String message;
}

