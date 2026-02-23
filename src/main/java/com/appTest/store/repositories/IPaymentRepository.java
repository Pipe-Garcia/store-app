package com.appTest.store.repositories;

import com.appTest.store.models.Payment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface IPaymentRepository extends JpaRepository<Payment, Long> {

    List<Payment> findBySale_IdSale(Long saleId);

    // ✅ NUEVO: usado por Caja para sincronizar pagos → movimientos
    List<Payment> findByDatePayment(LocalDate datePayment);
}