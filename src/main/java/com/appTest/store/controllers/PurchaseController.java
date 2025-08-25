package com.appTest.store.controllers;

import com.appTest.store.dto.purchase.PurchaseCreateDTO;
import com.appTest.store.dto.purchase.PurchaseDTO;
import com.appTest.store.dto.purchase.PurchaseUpdateDTO;
import com.appTest.store.models.Purchase;
import com.appTest.store.services.IPurchaseService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/purchases")
public class PurchaseController {

    @Autowired
    private IPurchaseService servPurchase;

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<PurchaseDTO>> getAllPurchases() {
        List<Purchase> purchaseList = servPurchase.getAllPurchases();
        List<PurchaseDTO> purchaseDTOList = purchaseList.stream()
                .map(purchase -> servPurchase.convertPurchaseToDto(purchase))
                .collect(Collectors.toList());
        return ResponseEntity.ok(purchaseDTOList);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<PurchaseDTO> getPurchaseById(@PathVariable Long id) {
        Purchase purchase = servPurchase.getPurchaseById(id);
        return ResponseEntity.ok(servPurchase.convertPurchaseToDto(purchase));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<PurchaseDTO> createPurchase(@RequestBody @Valid PurchaseCreateDTO dto) {
        PurchaseDTO createdPurchase = servPurchase.createPurchase(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdPurchase);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<PurchaseDTO> updatePurchase(@RequestBody @Valid PurchaseUpdateDTO dto) {
        servPurchase.updatePurchase(dto);
        Purchase purchase = servPurchase.getPurchaseById(dto.getIdPurchase());
        return ResponseEntity.ok(servPurchase.convertPurchaseToDto(purchase));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_OWNER')")
    public ResponseEntity<Void> deletePurchaseById(@PathVariable Long id) {
        servPurchase.deletePurchaseById(id);
        return ResponseEntity.noContent().build();
    }
}
