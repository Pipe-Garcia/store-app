package com.appTest.store.dto.audit;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public record StockMovementDTO(
        Long id, LocalDateTime timestamp,
        Long materialId, String materialName,
        Long warehouseId, String warehouseName,
        BigDecimal fromQty, BigDecimal toQty, BigDecimal delta,
        String reason, String sourceType, Long sourceId,
        String userName, String note
) {}

