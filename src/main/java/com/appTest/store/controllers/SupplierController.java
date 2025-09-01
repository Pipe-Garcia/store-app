package com.appTest.store.controllers;

import com.appTest.store.dto.supplier.SupplierCreateDTO;
import com.appTest.store.dto.supplier.SupplierDTO;
import com.appTest.store.services.ISupplierService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/suppliers")
public class SupplierController {

    @Autowired
    private ISupplierService supplierService;

    // ✅ Obtener todos los proveedores (resumen)
    @GetMapping
    public ResponseEntity<List<SupplierDTO>> getAllSuppliers() {
        List<SupplierDTO> suppliers = supplierService.getAllSuppliers();
        return ResponseEntity.ok(suppliers);
    }

    // ✅ Obtener proveedor por ID (incluye materiales)
    @GetMapping("/{id}")
    public ResponseEntity<SupplierDTO> getSupplierById(@PathVariable Long id) {
        SupplierDTO supplier = supplierService.getSupplierDtoById(id);
        return ResponseEntity.ok(supplier);
    }

    // ✅ Crear proveedor
    @PostMapping
    public ResponseEntity<SupplierDTO> createSupplier(@Valid @RequestBody SupplierCreateDTO dto) {
        SupplierDTO created = supplierService.createSupplier(dto);
        return ResponseEntity.ok(created);
    }

    // ✅ Editar proveedor
    @PutMapping("/{id}")
    public ResponseEntity<SupplierDTO> updateSupplier(@PathVariable Long id,
                                                      @Valid @RequestBody SupplierCreateDTO dto) {
        SupplierDTO updated = supplierService.updateSupplier(id, dto);
        return ResponseEntity.ok(updated);
    }

    // ✅ Eliminar proveedor
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSupplier(@PathVariable Long id) {
        supplierService.deleteSupplierById(id);
        return ResponseEntity.noContent().build();
    }
}
