// src/main/java/com/appTest/store/dto/orders/OrderDeliveryPendingDTO.java
package com.appTest.store.dto.orders;

import java.math.BigDecimal;

public record OrderDeliveryPendingDTO(
        Long orderDetailId,
        Long materialId,
        String materialName,
        BigDecimal quantityOrdered,
        BigDecimal deliveredSoFar,
        BigDecimal pendingToDeliver
) {}

