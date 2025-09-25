package com.appTest.store.services;

import com.appTest.store.dto.reservation.BulkReservationRequest;
import com.appTest.store.dto.reservation.ConsumeRequestDTO;
import com.appTest.store.dto.reservation.StockReservationCreateDTO;
import com.appTest.store.dto.reservation.StockReservationDTO;
import com.appTest.store.models.enums.ReservationStatus;

import java.math.BigDecimal;
import java.util.List;

public interface IStockReservationService {
    StockReservationDTO create(StockReservationCreateDTO dto);
    List<StockReservationDTO> search(Long clientId, Long orderId, ReservationStatus status);
    void cancel(Long idReservation);
    int expireNow(); // retorna cuántas pasaron a EXPIRED

    // (LEGACY) Mantener por compatibilidad temporal
    BigDecimal consumeForSale(Long clientId, Long materialId, Long warehouseId, BigDecimal qty);
    BigDecimal consumeForSale(Long clientId, Long materialId, Long warehouseId, BigDecimal qty, Long orderId);
    void recordDirectConsumption(Long clientId, Long materialId, Long warehouseId, BigDecimal qty, Long orderId);

    // NUEVO: Venta compromete (no descuenta on-hand)
    BigDecimal allocateForSale(Long clientId, Long materialId, Long warehouseId, BigDecimal qty, Long orderId);
    void recordDirectAllocation(Long clientId, Long materialId, Long warehouseId, BigDecimal qty, Long orderId);

    // NUEVO: Entrega consume lo allocado y ahí sí descuenta on-hand
    BigDecimal shipFromAllocation(Long clientId, Long materialId, Long warehouseId, BigDecimal qty, Long orderId);
    List<StockReservationDTO> bulkCreate(BulkReservationRequest req);
}

