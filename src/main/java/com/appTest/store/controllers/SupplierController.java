package com.appTest.store.controllers;

import com.appTest.store.dto.supplier.SupplierCreateDTO;
import com.appTest.store.dto.supplier.SupplierDTO;
import com.appTest.store.services.ISupplierService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/suppliers")
public class SupplierController {

    @Autowired
    private ISupplierService supplierService;

    // Obtener todos los proveedores (con filtro de eliminados)
    @GetMapping
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")
    public ResponseEntity<List<SupplierDTO>> getAllSuppliers(
            @RequestParam(required = false) Boolean includeDeleted
    ) {
        List<SupplierDTO> suppliers = supplierService.getAllSuppliers(includeDeleted);
        return ResponseEntity.ok(suppliers);
    }

    // Obtener proveedor por ID (incluye materiales)
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")
    public ResponseEntity<SupplierDTO> getSupplierById(@PathVariable Long id) {
        SupplierDTO supplier = supplierService.getSupplierDtoById(id);
        return ResponseEntity.ok(supplier);
    }

    // Crear proveedor
    @PostMapping
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")
    public ResponseEntity<SupplierDTO> createSupplier(@Valid @RequestBody SupplierCreateDTO dto) {
        SupplierDTO created = supplierService.createSupplier(dto);
        return ResponseEntity.ok(created);
    }

    // Editar proveedor
    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('EMPLOYEE','OWNER')")
    public ResponseEntity<SupplierDTO> updateSupplier(@PathVariable Long id,
                                                      @Valid @RequestBody SupplierCreateDTO dto) {
        SupplierDTO updated = supplierService.updateSupplier(id, dto);
        return ResponseEntity.ok(updated);
    }

    // Deshabilitar proveedor (Soft Delete)
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<String> deleteSupplier(@PathVariable Long id) {
        supplierService.deleteSupplierById(id);
        return ResponseEntity.ok("The supplier has been disabled (Soft Delete).");
    }

    // Restaurar proveedor
    @PutMapping("/{id}/restore")
    @PreAuthorize("hasRole('OWNER')")
    public ResponseEntity<String> restoreSupplier(@PathVariable Long id) {
        supplierService.restoreSupplier(id);
        return ResponseEntity.ok("The supplier has been restored successfully.");
    }
}
