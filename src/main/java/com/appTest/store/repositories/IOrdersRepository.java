package com.appTest.store.repositories;

import com.appTest.store.models.Client;
import com.appTest.store.models.Orders;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface IOrdersRepository extends JpaRepository<Orders, Long> {

    Optional<Orders> findTopByClientOrderByDateCreateDesc(Client client);

    @Query("""
           select o from Orders o
           left join fetch o.orderDetails d
           left join fetch d.material m
           where o.idOrders = :id
           """)
    Optional<Orders> findByIdWithDetails(@Param("id") Long id);
}

