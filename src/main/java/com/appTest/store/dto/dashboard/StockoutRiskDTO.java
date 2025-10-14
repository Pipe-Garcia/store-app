package com.appTest.store.dto.dashboard;

import java.math.BigDecimal;
import lombok.*;

@Getter @Setter @AllArgsConstructor @NoArgsConstructor
public class StockoutRiskDTO {
    private Long materialId;
    private String materialName;
    private BigDecimal available; // stock disponible total (todos los depósitos)
    private BigDecimal reserved;  // comprometido (ALLOCATED)
    public BigDecimal getDeficit() {
        BigDecimal a = available==null? BigDecimal.ZERO : available;
        BigDecimal r = reserved==null? BigDecimal.ZERO : reserved;
        return r.subtract(a); // >0 => faltante
    }
}
