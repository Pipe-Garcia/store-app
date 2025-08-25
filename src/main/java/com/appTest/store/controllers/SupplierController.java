package com.appTest.store.controllers;

import com.appTest.store.dto.supplier.SupplierCreateDTO;
import com.appTest.store.dto.supplier.SupplierDTO;
import com.appTest.store.dto.supplier.SupplierUpdateDTO;
import com.appTest.store.models.Supplier;
import com.appTest.store.services.ISupplierService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/suppliers")
public class SupplierController {

    @Autowired
    private ISupplierService servSupplier;

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<SupplierDTO>> getAllSuppliers() {
        List<Supplier> supplierList = servSupplier.getAllSuppliers();
        List<SupplierDTO> supplierDTOList = supplierList.stream()
                .map(supplier -> servSupplier.convertSupplierToDto(supplier))
                .collect(Collectors.toList());
        return ResponseEntity.ok(supplierDTOList);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<SupplierDTO> getSupplierById(@PathVariable Long id) {
        Supplier supplier = servSupplier.getSupplierById(id);
        return ResponseEntity.ok(servSupplier.convertSupplierToDto(supplier));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<SupplierDTO> createSupplier(@RequestBody @Valid SupplierCreateDTO dto) {
        SupplierDTO createdSupplier = servSupplier.createSupplier(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdSupplier);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<SupplierDTO> updateSupplier (@RequestBody @Valid SupplierUpdateDTO dto) {
        servSupplier.updateSupplier(dto);
        Supplier supplier = servSupplier.getSupplierById(dto.getIdSupplier());
        return ResponseEntity.ok(servSupplier.convertSupplierToDto(supplier));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_OWNER')")
    public ResponseEntity<Void> deleteSupplierById(@PathVariable Long id) {
        servSupplier.deleteSupplierById(id);
        return ResponseEntity.noContent().build();
    }
}
