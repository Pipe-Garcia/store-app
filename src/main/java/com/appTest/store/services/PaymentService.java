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
    public java.util.List<PaymentDTO> findBySaleId(Long saleId) {
        var list = repoPayment.findBySale_IdSale(saleId);
        java.util.List<PaymentDTO> dto = new java.util.ArrayList<>();
        for (var p : list){
            dto.add(convertPaymentToDto(p));
        }
        return dto;
    }

    @Override
    @Transactional
    public PaymentDTO createPayment(PaymentCreateDTO dto) {

        // 1) Buscar venta
        Sale sale = repoSale.findById(dto.getSaleId())
                .orElseThrow(() -> new EntityNotFoundException(
                        "Sale not found with ID: " + dto.getSaleId()
                ));

        // 2) Total de la venta
        BigDecimal saleTotal = (sale.getSaleDetailList() == null)
                ? BigDecimal.ZERO
                : sale.getSaleDetailList().stream()
                .map(detail -> {
                    BigDecimal q = detail.getQuantity() != null ? detail.getQuantity() : BigDecimal.ZERO;
                    BigDecimal p = detail.getPriceUni() != null ? detail.getPriceUni() : BigDecimal.ZERO;
                    return q.multiply(p);
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        // 3) Pagado hasta ahora
        BigDecimal alreadyPaid = (sale.getPaymentList() == null)
                ? BigDecimal.ZERO
                : sale.getPaymentList().stream()
                .map(p -> p.getAmount() != null ? p.getAmount() : BigDecimal.ZERO)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal remaining = saleTotal.subtract(alreadyPaid);
        if (remaining.compareTo(BigDecimal.ZERO) < 0) {
            remaining = BigDecimal.ZERO;
        }

        // 4) Validar que el nuevo pago no exceda el saldo
        if (dto.getAmount().compareTo(remaining) > 0) {
            throw new IllegalArgumentException(
                    "Payment amount cannot exceed remaining balance for the sale."
            );
        }

        // 5) Crear pago
        Payment payment = new Payment();
        payment.setAmount(dto.getAmount());
        payment.setDatePayment(dto.getDatePayment());
        payment.setMethodPayment(dto.getMethodPayment());
        payment.setSale(sale);

        BigDecimal totalPaidAfter = alreadyPaid.add(dto.getAmount());
        payment.setStatus(calculatePaymentStatus(totalPaidAfter, saleTotal));

        Payment savedPayment = repoPayment.save(payment);
        return convertPaymentToDto(savedPayment);
    }


    @Override
    @Transactional
    public void updatePayment(PaymentUpdateDTO dto) {
        Payment payment = repoPayment.findById(dto.getIdPayment())
                .orElseThrow(() -> new EntityNotFoundException("Payment not found with ID: " + dto.getIdPayment()));

        Sale sale = payment.getSale();

        // Si cambia el importe, hay que validar contra el saldo
        if (dto.getAmount() != null) {

            // Total de la venta
            BigDecimal saleTotal = (sale.getSaleDetailList() == null)
                    ? BigDecimal.ZERO
                    : sale.getSaleDetailList().stream()
                    .map(detail -> {
                        BigDecimal q = detail.getQuantity() != null ? detail.getQuantity() : BigDecimal.ZERO;
                        BigDecimal p = detail.getPriceUni() != null ? detail.getPriceUni() : BigDecimal.ZERO;
                        return q.multiply(p);
                    })
                    .reduce(BigDecimal.ZERO, BigDecimal::add);

            // Suma de los otros pagos (excepto el que estamos editando)
            BigDecimal othersPaid = BigDecimal.ZERO;
            if (sale.getPaymentList() != null) {
                for (Payment p : sale.getPaymentList()) {
                    if (p.getIdPayment() != null && p.getIdPayment().equals(payment.getIdPayment())) {
                        continue; // saltamos el actual
                    }
                    if (p.getAmount() != null) {
                        othersPaid = othersPaid.add(p.getAmount());
                    }
                }
            }

            BigDecimal newTotalPaid = othersPaid.add(dto.getAmount());

            if (newTotalPaid.compareTo(saleTotal) > 0) {
                throw new IllegalArgumentException(
                        "Payment amount cannot exceed remaining balance for the sale."
                );
            }

            // Sólo ahora actualizamos el importe y el status
            payment.setAmount(dto.getAmount());
            payment.setStatus(calculatePaymentStatus(newTotalPaid, saleTotal));
        }

        if (dto.getDatePayment() != null) {
            payment.setDatePayment(dto.getDatePayment());
        }
        if (dto.getMethodPayment() != null) {
            payment.setMethodPayment(dto.getMethodPayment());
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
