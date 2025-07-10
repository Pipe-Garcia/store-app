package com.appTest.store.repositories;

import com.appTest.store.models.Delivery;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IDeliveryRepository extends JpaRepository <Delivery, Long> {
}
