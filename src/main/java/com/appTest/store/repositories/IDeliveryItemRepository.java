package com.appTest.store.repositories;

import com.appTest.store.models.DeliveryItem;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface IDeliveryItemRepository extends JpaRepository<DeliveryItem, Long> {

    @Query("""
      select coalesce(sum(di.quantityDelivered), 0)
      from DeliveryItem di
      where di.orderDetail.orders.idOrders = :orderId
        and di.delivery.status <> com.appTest.store.models.enums.DeliveryStatus.CANCELLED
    """)
    BigDecimal sumDeliveredByOrder(@Param("orderId") Long orderId);

    @Query("""
      select coalesce(sum(di.quantityDelivered), 0)
      from DeliveryItem di
      where di.orderDetail.idOrderDetail = :orderDetailId
        and di.delivery.status <> com.appTest.store.models.enums.DeliveryStatus.CANCELLED
    """)
    BigDecimal sumDeliveredByOrderDetail(@Param("orderDetailId") Long orderDetailId);

    @Query("""
      select di.orderDetail.idOrderDetail, coalesce(sum(di.quantityDelivered), 0)
      from DeliveryItem di
      where di.orderDetail.orders.idOrders = :orderId
        and di.delivery.status <> com.appTest.store.models.enums.DeliveryStatus.CANCELLED
      group by di.orderDetail.idOrderDetail
    """)
    List<Object[]> deliveredByOrderDetail(@Param("orderId") Long orderId);
}