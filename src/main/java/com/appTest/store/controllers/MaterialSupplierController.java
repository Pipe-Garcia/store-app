package com.appTest.store.controllers;

import com.appTest.store.dto.materialSupplier.MaterialSupplierCreateDTO;
import com.appTest.store.dto.materialSupplier.MaterialSupplierDTO;
import com.appTest.store.dto.materialSupplier.MaterialSupplierUpdateDTO;
import com.appTest.store.models.MaterialSupplier;
import com.appTest.store.services.IMaterialSupplierService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/material-suppliers")
public class MaterialSupplierController {

    @Autowired
    private IMaterialSupplierService servMatSup;

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<MaterialSupplierDTO>> getAllMaterialSuppliers() {
        List<MaterialSupplier> materialSupplierList = servMatSup.getAllMaterialSuppliers();
        List<MaterialSupplierDTO> materialSupplierDTOList = materialSupplierList.stream()
                .map(materialSupplier -> servMatSup.convertMaterialSupplierToDto(materialSupplier))
                .collect(Collectors.toList());
        return ResponseEntity.ok(materialSupplierDTOList);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<MaterialSupplierDTO> getMaterialSupplierById(@PathVariable Long id) {
        MaterialSupplier materialSupplier = servMatSup.getMaterialSupplierById(id);
        return ResponseEntity.ok(servMatSup.convertMaterialSupplierToDto(materialSupplier));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<MaterialSupplierDTO> createMaterialSupplier(@RequestBody @Valid MaterialSupplierCreateDTO dto) {
        MaterialSupplierDTO createdMaterialSupplier = servMatSup.createMaterialSupplier(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdMaterialSupplier);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<MaterialSupplierDTO> updateMaterialSupplier(@RequestBody @Valid MaterialSupplierUpdateDTO dto) {
        servMatSup.updateMaterialSupplier(dto);
        MaterialSupplier materialSupplier = servMatSup.getMaterialSupplierById(dto.getIdMaterialSupplier());
        return ResponseEntity.ok(servMatSup.convertMaterialSupplierToDto(materialSupplier));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_OWNER')")
    public ResponseEntity<Void> deleteMaterialSupplierById(@PathVariable Long id) {
        servMatSup.deleteMaterialSupplierById(id);
        return ResponseEntity.noContent().build();
    }
    @GetMapping("/by-supplier/{supplierId}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<MaterialSupplierDTO>> getBySupplier(@PathVariable Long supplierId) {
        List<MaterialSupplier> list = servMatSup.getBySupplierId(supplierId);
        List<MaterialSupplierDTO> dto = list.stream()
                .map(servMatSup::convertMaterialSupplierToDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dto);
    }

}
