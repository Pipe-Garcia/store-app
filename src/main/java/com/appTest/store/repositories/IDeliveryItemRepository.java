package com.appTest.store.repositories;

import com.appTest.store.models.DeliveryItem;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface IDeliveryItemRepository extends JpaRepository<DeliveryItem, Long> {

    @Query("""
      select coalesce(sum(di.quantityDelivered), 0)
      from DeliveryItem di
      where di.orderDetail.orders.idOrders = :orderId
    """)
    BigDecimal sumDeliveredByOrder(@Param("orderId") Long orderId);

    @Query("""
      select coalesce(sum(di.quantityDelivered), 0)
      from DeliveryItem di
      where di.orderDetail.idOrderDetail = :orderDetailId
    """)
    BigDecimal sumDeliveredByOrderDetail(@Param("orderDetailId") Long orderDetailId);
}

