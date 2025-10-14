package com.appTest.store.models.audit;

import jakarta.persistence.*;
import lombok.Getter; import lombok.Setter;

@Entity @Getter @Setter
public class AuditDetail {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional=false) @JoinColumn(name="event_id")
    private AuditEvent event;

    @Lob private String diffJson;
    @Lob private String oldJson;
    @Lob private String newJson;
}

