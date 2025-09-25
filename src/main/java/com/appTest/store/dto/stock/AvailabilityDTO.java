package com.appTest.store.dto.stock;
import lombok.*;
import java.io.Serializable;
import java.math.BigDecimal;

@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class AvailabilityDTO implements Serializable {
    private Long materialId;
    private Long warehouseId;
    private BigDecimal quantityAvailable;
}
