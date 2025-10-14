package com.appTest.store.dto.audit;

import java.time.LocalDateTime;

public record AuditEventListDTO(
        Long id, LocalDateTime timestamp,
        String actorName, String action,
        String entity, Long entityId,
        String status, String message
) {}

