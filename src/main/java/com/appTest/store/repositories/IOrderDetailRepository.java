package com.appTest.store.repositories;

import com.appTest.store.models.OrderDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IOrderDetailRepository extends JpaRepository <OrderDetail, Long> {
}
