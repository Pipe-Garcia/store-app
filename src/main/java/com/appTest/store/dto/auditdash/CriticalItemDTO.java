// src/main/java/com/appTest/store/dto/auditdash/CriticalItemDTO.java
package com.appTest.store.dto.auditdash;

import java.time.LocalDateTime;

public record CriticalItemDTO(
        Long id, LocalDateTime timestamp, String actorName,
        String action, String entity, Long entityId, String status, String message
) {}
