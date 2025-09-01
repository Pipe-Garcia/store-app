package com.appTest.store.repositories;

import com.appTest.store.models.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IPaymentRepository extends JpaRepository <Payment, Long> {
    // IMPORTANTE: suma este método
    List<Payment> findBySale_IdSale(Long saleId);
}
