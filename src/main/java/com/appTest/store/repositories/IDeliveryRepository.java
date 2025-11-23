// src/main/java/com/appTest/store/repositories/IDeliveryRepository.java
package com.appTest.store.repositories;

import com.appTest.store.models.Delivery;
import com.appTest.store.models.enums.DeliveryStatus;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface IDeliveryRepository extends JpaRepository<Delivery, Long> {

    @EntityGraph(attributePaths = {"orders", "orders.client", "items", "items.orderDetail", "items.material", "items.warehouse"})
    @Query("select d from Delivery d where d.idDelivery = :id")
    Optional<Delivery> findByIdWithGraph(@Param("id") Long id);

    @EntityGraph(attributePaths = {"orders", "orders.client"})
    List<Delivery> findByStatus(DeliveryStatus status);

    @EntityGraph(attributePaths = {
            "orders", "orders.client",
            "sale", "sale.client"
    })
    @Query("""
    select d from Delivery d
       where (:status  is null or d.status = :status)
         and (:saleId  is null or d.sale.idSale = :saleId)
         and (
               :clientId is null
            or d.sale.client.idClient   = :clientId
            or d.orders.client.idClient = :clientId
         )
         and (:from   is null or d.deliveryDate >= :from)
         and (:to     is null or d.deliveryDate <= :to)
       order by d.deliveryDate desc, d.idDelivery desc
    """)
    List<Delivery> search(
            @Param("status")   DeliveryStatus status,
            @Param("saleId")   Long saleId,
            @Param("clientId") Long clientId,
            @Param("from")     LocalDate from,
            @Param("to")       LocalDate to
    );

    @EntityGraph(attributePaths = {
            "sale", "sale.client",
            "orders", "orders.client",
            "items", "items.orderDetail", "items.material", "items.warehouse"
    })
    List<Delivery> findBySale_IdSale(Long saleId);

    // ===== NUEVO: listar entregas por pedido =====
    @EntityGraph(attributePaths = {"orders", "orders.client"})
    List<Delivery> findByOrders_IdOrders(Long orderId);

    // ===== NUEVO (detallado con items) =====
    @EntityGraph(attributePaths = {
            "orders", "orders.client",
            "items", "items.orderDetail", "items.material", "items.warehouse"
    })
    @Query("select d from Delivery d where d.orders.idOrders = :orderId")
    List<Delivery> findByOrderIdWithGraph(@Param("orderId") Long orderId);

    @Query("select count(d) from Delivery d where d.deliveryDate = :date and d.status <> com.appTest.store.models.enums.DeliveryStatus.COMPLETED")
    Long countOpenByDate(java.time.LocalDate date);

}
