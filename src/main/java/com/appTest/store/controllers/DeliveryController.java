// src/main/java/com/appTest/store/controllers/DeliveryController.java
package com.appTest.store.controllers;

import com.appTest.store.dto.delivery.DeliveryCreateDTO;
import com.appTest.store.dto.delivery.DeliveryDTO;
import com.appTest.store.dto.delivery.DeliveryDetailDTO;
import com.appTest.store.dto.delivery.DeliveryUpdateDTO;
import com.appTest.store.models.Delivery;
import com.appTest.store.services.IDeliveryService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import com.appTest.store.models.enums.DeliveryStatus;
import org.springframework.format.annotation.DateTimeFormat;


import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/deliveries")
public class DeliveryController {

    @Autowired
    private IDeliveryService servDelivery;

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<DeliveryDTO>> getAllDeliveries() {
        List<Delivery> deliveryList = servDelivery.getAllDeliveries();
        List<DeliveryDTO> deliveryDTOList = deliveryList.stream()
                .map(servDelivery::convertDeliveryToDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(deliveryDTOList);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<DeliveryDTO> getDeliveryById(@PathVariable Long id) {
        Delivery delivery = servDelivery.getDeliveryById(id);
        return ResponseEntity.ok(servDelivery.convertDeliveryToDto(delivery));
    }

    @GetMapping("/{id}/detail")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<DeliveryDetailDTO> getDeliveryDetail(@PathVariable Long id) {
        return ResponseEntity.ok(servDelivery.getDeliveryDetail(id));
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<DeliveryDTO>> search(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) Long saleId,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false)
            @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to
    ) {
        // Parsear el enum de manera tolerante
        DeliveryStatus st = null;
        if (status != null && !status.isBlank()) {
            try {
                st = DeliveryStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException ignored) {
                // Si mandan algo raro en status, lo ignoramos y buscamos sin filtro de estado
            }
        }

        List<Delivery> list = servDelivery.search(st, saleId, clientId, from, to);

        List<DeliveryDTO> dtoList = list.stream()
                .map(servDelivery::convertDeliveryToDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(dtoList);
    }

    @GetMapping("/by-sale/{saleId}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<DeliveryDTO>> getBySale(@PathVariable Long saleId) {
        return ResponseEntity.ok(servDelivery.getDeliveriesBySale(saleId));
    }


    // ===== NUEVO: entregas por pedido (compacto) =====
    @GetMapping("/by-order/{orderId}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<DeliveryDTO>> getByOrder(@PathVariable Long orderId) {
        return ResponseEntity.ok(servDelivery.getDeliveriesByOrder(orderId));
    }

    // ===== NUEVO: entregas por pedido (detallado) =====
    @GetMapping("/by-order/{orderId}/detail")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<DeliveryDetailDTO>> getDetailsByOrder(@PathVariable Long orderId) {
        return ResponseEntity.ok(servDelivery.getDeliveryDetailsByOrder(orderId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<DeliveryDTO> createDelivery(@RequestBody @Valid DeliveryCreateDTO dto) {
        DeliveryDTO createdDelivery = servDelivery.createDelivery(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdDelivery);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<DeliveryDTO> updateDelivery(@RequestBody @Valid DeliveryUpdateDTO dto) {
        servDelivery.updateDelivery(dto);
        Delivery delivery = servDelivery.getDeliveryById(dto.getIdDelivery());
        return ResponseEntity.ok(servDelivery.convertDeliveryToDto(delivery));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_OWNER')")
    public ResponseEntity<Void> deleteDeliveryById(@PathVariable Long id) {
        servDelivery.deleteDeliveryById(id);
        return ResponseEntity.noContent().build();
    }
}
