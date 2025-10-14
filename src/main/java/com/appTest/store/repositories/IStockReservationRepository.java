package com.appTest.store.repositories;

import com.appTest.store.models.StockReservation;
import com.appTest.store.models.enums.ReservationStatus;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface IStockReservationRepository extends JpaRepository<StockReservation, Long> {

    @Query("""
      select coalesce(sum(r.quantity), 0)
      from StockReservation r
      where r.status = com.appTest.store.models.enums.ReservationStatus.ACTIVE
        and r.material.idMaterial = :materialId
        and r.warehouse.idWarehouse = :warehouseId
    """)
    BigDecimal sumActiveByMaterialWarehouse(@Param("materialId") Long materialId,
                                            @Param("warehouseId") Long warehouseId);

    @Query("""
      select r
      from StockReservation r
      where r.status = com.appTest.store.models.enums.ReservationStatus.ACTIVE
        and r.client.idClient = :clientId
        and r.material.idMaterial = :materialId
        and (:warehouseId is null or r.warehouse.idWarehouse = :warehouseId)
      order by r.expiresAt nulls last, r.idReservation
    """)
    List<StockReservation> findActiveForConsume(@Param("clientId") Long clientId,
                                                @Param("materialId") Long materialId,
                                                @Param("warehouseId") Long warehouseId);

    List<StockReservation> findByStatus(ReservationStatus status);

    @Query("""
      select r
      from StockReservation r
      where (:clientId is null or r.client.idClient = :clientId)
        and (:orderId  is null or r.orders.idOrders = :orderId)
        and (:status   is null or r.status = :status)
      order by r.reservedAt desc
    """)
    List<StockReservation> search(@Param("clientId") Long clientId,
                                  @Param("orderId") Long orderId,
                                  @Param("status") ReservationStatus status);

    // Total consumido por pedido+material
    @Query("""
      select coalesce(sum(r.quantity), 0)
      from StockReservation r
      where r.orders.idOrders = :orderId
        and r.material.idMaterial = :materialId
        and r.status = com.appTest.store.models.enums.ReservationStatus.CONSUMED
    """)
    BigDecimal consumedQtyForOrderAndMaterial(@Param("orderId") Long orderId,
                                                  @Param("materialId") Long materialId);

    // Mapa material -> consumido
    @Query("""
      select r.material.idMaterial, coalesce(sum(r.quantity), 0)
      from StockReservation r
      where r.orders.idOrders = :orderId
        and r.status = com.appTest.store.models.enums.ReservationStatus.CONSUMED
      group by r.material.idMaterial
    """)
    List<Object[]> consumedByMaterialForOrder(@Param("orderId") Long orderId);

    // ADD: seleccionar reservas activas para consumir, opcionalmente por pedido
    @Query("""
    select r
    from StockReservation r
    where r.status = com.appTest.store.models.enums.ReservationStatus.ACTIVE
        and r.client.idClient = :clientId
        and r.material.idMaterial = :materialId
        and r.orders.idOrders = :orderId
        and (:warehouseId is null or r.warehouse.idWarehouse = :warehouseId)
    order by r.expiresAt nulls last, r.idReservation
    """)
    List<StockReservation> pickActiveForConsume(@Param("clientId") Long clientId,
                                                @Param("orderId") Long orderId,
                                                @Param("materialId") Long materialId,
                                                @Param("warehouseId") Long warehouseId);
    @Query("""
     select coalesce(sum(r.quantity), 0)
     from StockReservation r
     where r.status = com.appTest.store.models.enums.ReservationStatus.ALLOCATED
       and r.material.idMaterial = :materialId
       and r.warehouse.idWarehouse = :warehouseId
   """)
   BigDecimal sumAllocatedByMaterialWarehouse(@Param("materialId") Long materialId,
                                              @Param("warehouseId") Long warehouseId);

   // Reservas ACTIVE a priorizar para ALLOCATE (pedido opcional)
   @Query("""
     select r
     from StockReservation r
     where r.status = com.appTest.store.models.enums.ReservationStatus.ACTIVE
       and r.client.idClient = :clientId
       and r.material.idMaterial = :materialId
       and (:orderId is null or r.orders.idOrders = :orderId)
       and (:warehouseId is null or r.warehouse.idWarehouse = :warehouseId)
     order by r.expiresAt nulls last, r.idReservation
   """)
   List<StockReservation> pickActiveForAllocate(@Param("clientId") Long clientId,
                                                @Param("materialId") Long materialId,
                                                @Param("warehouseId") Long warehouseId,
                                                @Param("orderId") Long orderId);

   // Registros ALLOCATED a consumir en la entrega
     @Query("""
     select r
     from StockReservation r
     where r.status = com.appTest.store.models.enums.ReservationStatus.ALLOCATED
       and (:clientId is null or r.client.idClient = :clientId)
       and r.material.idMaterial = :materialId
       and (:orderId is null or r.orders.idOrders = :orderId)
       and (:warehouseId is null or r.warehouse.idWarehouse = :warehouseId)
     order by r.idReservation
   """)
   List<StockReservation> pickAllocatedForShipment(@Param("clientId") Long clientId,
                                                   @Param("materialId") Long materialId,
                                                   @Param("warehouseId") Long warehouseId,
                                                   @Param("orderId") Long orderId);

    // Totales por pedido (ALLOCATED)
    @Query("""
     select coalesce(sum(r.quantity), 0)
     from StockReservation r
     where r.orders.idOrders = :orderId
       and r.material.idMaterial = :materialId
       and r.status = com.appTest.store.models.enums.ReservationStatus.ALLOCATED
   """)
   BigDecimal allocatedQtyForOrderAndMaterial(@Param("orderId") Long orderId,
                                              @Param("materialId") Long materialId);


       // Mapa material -> ALLOCATED (vendido/comprometido)
       @Query("""
      select r.material.idMaterial, coalesce(sum(r.quantity), 0)
      from StockReservation r
      where r.orders.idOrders = :orderId
        and r.status = com.appTest.store.models.enums.ReservationStatus.ALLOCATED
      group by r.material.idMaterial
    """)
    List<Object[]> allocatedByMaterialForOrder(@Param("orderId") Long orderId);


    @Query("""
      select r.material.idMaterial, coalesce(sum(r.quantity), 0)
      from StockReservation r
      where r.status = com.appTest.store.models.enums.ReservationStatus.ACTIVE
      group by r.material.idMaterial
    """)
    List<Object[]> sumActiveByMaterial();


    @Query("""
      select r.material.idMaterial, coalesce(sum(r.quantity), 0)
      from StockReservation r
      where r.status = com.appTest.store.models.enums.ReservationStatus.ALLOCATED
      group by r.material.idMaterial
    """)
    List<Object[]> allocatedByMaterialGlobal();

}

