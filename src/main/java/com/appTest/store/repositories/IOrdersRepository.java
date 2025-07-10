package com.appTest.store.repositories;

import com.appTest.store.models.Orders;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IOrdersRepository extends JpaRepository <Orders, Long> {
}
