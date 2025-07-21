package com.appTest.store.services;

import com.appTest.store.dto.payment.PaymentCreateDTO;
import com.appTest.store.dto.payment.PaymentDTO;
import com.appTest.store.dto.payment.PaymentUpdateDTO;
import com.appTest.store.models.Payment;

import java.util.List;

public interface IPaymentService {
    List<Payment> getAllPayments();
    Payment getPaymentById(Long id);
    PaymentDTO convertPaymentToDto(Payment payment);
    PaymentDTO createPayment(PaymentCreateDTO dto);
    void updatePayment(PaymentUpdateDTO dto);
    void deletePaymentById(Long id);
}
