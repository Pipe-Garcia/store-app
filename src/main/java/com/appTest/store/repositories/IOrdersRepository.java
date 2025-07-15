package com.appTest.store.repositories;

import com.appTest.store.models.Client;
import com.appTest.store.models.Orders;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IOrdersRepository extends JpaRepository <Orders, Long> {
    Optional<Orders> findTopByClientOrderByDateCreateDesc(Client client);
}
