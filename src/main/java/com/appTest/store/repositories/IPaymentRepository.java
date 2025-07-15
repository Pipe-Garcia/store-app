package com.appTest.store.repositories;

import com.appTest.store.models.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IPaymentRepository extends JpaRepository <Payment, Long> {
}
