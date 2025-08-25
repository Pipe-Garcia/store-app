package com.appTest.store.controllers;

import com.appTest.store.dto.delivery.DeliveryCreateDTO;
import com.appTest.store.dto.delivery.DeliveryDTO;
import com.appTest.store.dto.delivery.DeliveryUpdateDTO;
import com.appTest.store.models.Delivery;
import com.appTest.store.services.IDeliveryService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

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
                .map(delivery -> servDelivery.convertDeliveryToDto(delivery))
                .collect(Collectors.toList());

        return ResponseEntity.ok(deliveryDTOList);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<DeliveryDTO> getDeliveryById(@PathVariable Long id) {
        Delivery delivery = servDelivery.getDeliveryById(id);
        return ResponseEntity.ok(servDelivery.convertDeliveryToDto(delivery));
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
