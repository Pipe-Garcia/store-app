// src/main/java/com/appTest/store/dto/auditdash/AuditSeries30DTO.java
package com.appTest.store.dto.auditdash;

import java.time.LocalDate;
import java.util.List;

public record AuditSeries30DTO(
        List<LocalDate> labels,
        List<Long> success,
        List<Long> fail
) {}
