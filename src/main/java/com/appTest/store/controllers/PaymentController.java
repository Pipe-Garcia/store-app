package com.appTest.store.controllers;

import com.appTest.store.dto.payment.PaymentCreateDTO;
import com.appTest.store.dto.payment.PaymentDTO;
import com.appTest.store.dto.payment.PaymentUpdateDTO;
import com.appTest.store.models.Payment;
import com.appTest.store.services.IPaymentService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/payments")
public class PaymentController {

    @Autowired
    private IPaymentService servPayment;

    @GetMapping
    public ResponseEntity<List<PaymentDTO>> getAllPayments() {
        List<Payment> paymentList = servPayment.getAllPayments();

        List<PaymentDTO> paymentDTOList = paymentList.stream()
                .map(payment -> servPayment.convertPaymentToDto(payment))
                .collect(Collectors.toList());

        return ResponseEntity.ok(paymentDTOList);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PaymentDTO> getPaymentById(@PathVariable Long id) {
        Payment payment = servPayment.getPaymentById(id);
        if (payment == null) {
            return ResponseEntity.notFound().build();
        }
        PaymentDTO paymentDTO = servPayment.convertPaymentToDto(payment);
        return ResponseEntity.ok(paymentDTO);
    }

    @PostMapping
    public ResponseEntity<PaymentDTO> createPayment(@RequestBody @Valid PaymentCreateDTO dto) {
        PaymentDTO createdPayment = servPayment.createPayment(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdPayment);
    }

    @PutMapping
    public ResponseEntity<PaymentDTO> updatePayment(@RequestBody @Valid PaymentUpdateDTO dto) {
        servPayment.updatePayment(dto);
        Payment payment = servPayment.getPaymentById(dto.getIdPayment());
        return ResponseEntity.ok(servPayment.convertPaymentToDto(payment));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deletePaymentById(@PathVariable Long id) {
        Payment payment = servPayment.getPaymentById(id);
        if (payment != null) {
            servPayment.deletePaymentById(id);
            return ResponseEntity.ok().body("The Payment has been successfully deleted");
        }
        return ResponseEntity.notFound().build();
    }
}
