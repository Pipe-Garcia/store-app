package com.appTest.store.dto.audit;

import java.time.LocalDateTime;
import java.util.List;

public record AuditEventDetailDTO(
        Long id, LocalDateTime timestamp,
        String actorName, String roles,
        String ip, String userAgent, String requestId,
        String action, String entity, Long entityId,
        String status, String message,
        List<DiffRow> changes
){
    public record DiffRow(String diffJson, String oldJson, String newJson){}
}

