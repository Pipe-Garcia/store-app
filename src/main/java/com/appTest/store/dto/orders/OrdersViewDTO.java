package com.appTest.store.dto.orders;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Getter @Setter
@NoArgsConstructor
public class OrdersViewDTO implements Serializable {

    private Long idOrders;

    private Long clientId;
    private String clientName;

    private LocalDate dateCreate;
    private LocalDate dateDelivery;

    /** Total monetario del presupuesto (suma de priceUni * quantityOrdered). */
    private BigDecimal total;

    /** true si NO queda nada pendiente de ENTREGAR (remainingUnits == 0). */
    private Boolean soldOut;

    /** Unidades pendientes de entrega = sum(pedidas - entregadas). */
    private BigDecimal remainingUnits;

    /** Unidades efectivamente entregadas. */
    private BigDecimal deliveredUnits;

    /**
     * Unidades "comprometidas" = vendidas pero aún no entregadas,
     * acotadas por lo efectivamente pendiente de entregar.
     */
    private BigDecimal committedUnits;

    /** Detalle por renglón. */
    private List<OrderDetailViewDTO> details;

    // ================= NUEVOS CAMPOS DERIVADOS =================

    /** Total de unidades presupuestadas (suma de OrderDetail.quantity). */
    private BigDecimal totalOrderedUnits;

    /** Total de unidades vendidas (sumatoria de todas las ventas asociadas). */
    private BigDecimal totalSoldUnits;

    /** Pendiente por vender = totalOrderedUnits - totalSoldUnits (nunca < 0). */
    private BigDecimal totalPendingToSellUnits;

    /**
     * true cuando el presupuesto está completamente VENDIDO
     * (totalPendingToSellUnits == 0), independientemente de la entrega.
     */
    private Boolean fullySold;

    // Constructor "viejo" para conservar compatibilidad con código existente
    public OrdersViewDTO(Long idOrders,
                         Long clientId,
                         String clientName,
                         LocalDate dateCreate,
                         LocalDate dateDelivery,
                         BigDecimal total,
                         Boolean soldOut,
                         BigDecimal remainingUnits,
                         BigDecimal deliveredUnits,
                         BigDecimal committedUnits,
                         List<OrderDetailViewDTO> details) {
        this.idOrders = idOrders;
        this.clientId = clientId;
        this.clientName = clientName;
        this.dateCreate = dateCreate;
        this.dateDelivery = dateDelivery;
        this.total = total;
        this.soldOut = soldOut;
        this.remainingUnits = remainingUnits;
        this.deliveredUnits = deliveredUnits;
        this.committedUnits = committedUnits;
        this.details = details;
    }
}


