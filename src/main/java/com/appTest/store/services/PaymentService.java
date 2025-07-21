package com.appTest.store.services;

import com.appTest.store.dto.payment.PaymentCreateDTO;
import com.appTest.store.dto.payment.PaymentDTO;
import com.appTest.store.dto.payment.PaymentUpdateDTO;
import com.appTest.store.models.Payment;
import com.appTest.store.models.Sale;
import com.appTest.store.repositories.IPaymentRepository;
import com.appTest.store.repositories.ISaleRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

@Service
public class PaymentService implements IPaymentService{

    @Autowired
    private IPaymentRepository repoPayment;

    @Autowired
    
    private ISaleRepository repoSale;

    @Override
    public List<Payment> getAllPayments() {
        return repoPayment.findAll();
    }

    @Override
    public Payment getPaymentById(Long id) {
        return repoPayment.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Payment not found with ID: " + id));
    }

    @Override
    public PaymentDTO convertPaymentToDto(Payment payment) {

        String clientName = payment.getSale().getClient().getName();
        String clientSurname = payment.getSale().getClient().getSurname();
        String completedClientName = clientName + " " + clientSurname;
        return new PaymentDTO(
                payment.getIdPayment(),
                payment.getAmount(),
                payment.getDatePayment(),
                payment.getMethodPayment(),
                payment.getStatus(),
                payment.getSale().getIdSale(),
                completedClientName
        );
    }

    @Override
    @Transactional
    public PaymentDTO createPayment(PaymentCreateDTO dto) {
        Payment payment = new Payment();
        payment.setAmount(dto.getAmount());
        payment.setDatePayment(dto.getDatePayment());
        payment.setMethodPayment(dto.getMethodPayment());
        Sale sale = repoSale.findById(dto.getSaleId())
                .orElseThrow(() -> new EntityNotFoundException("Sale not found with ID: " + dto.getSaleId()));
        payment.setSale(sale);
        BigDecimal totalPaid = sale.getPaymentList().stream()
                .map(Payment::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .add(dto.getAmount());
        BigDecimal saleTotal = sale.getSaleDetailList().stream()
                .map(detail -> detail.getQuantity().multiply(detail.getPriceUni()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        payment.setStatus(calculatePaymentStatus(totalPaid, saleTotal));
        Payment savedPayment = repoPayment.save(payment);
        return convertPaymentToDto(savedPayment);
    }

    @Override
    @Transactional
    public void updatePayment(PaymentUpdateDTO dto) {
        Payment payment = repoPayment.findById(dto.getIdPayment())
                .orElseThrow(() -> new EntityNotFoundException("Payment not found with ID: " + dto.getIdPayment()));
        if (dto.getAmount() != null) payment.setAmount(dto.getAmount());
        if (dto.getDatePayment() != null) payment.setDatePayment(dto.getDatePayment());
        if (dto.getMethodPayment() != null) payment.setMethodPayment(dto.getMethodPayment());

        if (dto.getAmount() != null) {
            BigDecimal totalPaid = payment.getSale().getPaymentList().stream()
                    .map(Payment::getAmount)
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal saleTotal = payment.getSale().getSaleDetailList().stream()
                    .map(detail -> detail.getQuantity().multiply(detail.getPriceUni()))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            payment.setStatus(calculatePaymentStatus(totalPaid, saleTotal));
        }
        repoPayment.save(payment);
    }

    private String calculatePaymentStatus(BigDecimal totalPaid, BigDecimal saleTotal) {
        if (totalPaid.compareTo(BigDecimal.ZERO) == 0) {
            return "PENDING";
        } else if (totalPaid.compareTo(saleTotal) < 0) {
            return "PARTIAL";
        } else {
            return "PAID";
        }
    }

    @Override
    @Transactional
    public void deletePaymentById(Long id) {
        repoPayment.deleteById(id);
    }
}
