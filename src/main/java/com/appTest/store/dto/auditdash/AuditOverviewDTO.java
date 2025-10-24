// src/main/java/com/appTest/store/dto/auditdash/AuditOverviewDTO.java
package com.appTest.store.dto.auditdash;

import java.time.LocalDateTime;

public record AuditOverviewDTO(
        long eventsToday,
        double successRate24h,
        long sensitiveCount7d,
        long activeUsers7d,
        LastFailureDTO lastFailure // puede ser null
) {
    public record LastFailureDTO(
            Long id, LocalDateTime timestamp, String actorName,
            String action, String entity, Long entityId, String message
    ){}
}
