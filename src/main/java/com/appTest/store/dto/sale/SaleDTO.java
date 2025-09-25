package com.appTest.store.dto.sale;

import lombok.Getter; import lombok.Setter;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

@Getter @Setter
public class SaleDTO implements Serializable {

    private Long idSale;

    // ✅ para filtrar por ID sin depender del nombre
    private Long clientId;
    private String clientName;

    private LocalDate dateSale;

    // ✅ ahora vienen precalculados
    private BigDecimal total;
    private BigDecimal paid;
    private BigDecimal balance;        // total - paid (>= 0)
    private String paymentStatus;      // PENDING | PARTIAL | PAID

    // compat opcional (podés mantenerlo o removerlo luego)
    private String paymentMethod;

    private Long deliveryId;

    private Long orderId;
}
