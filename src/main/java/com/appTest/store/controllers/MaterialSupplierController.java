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
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/material-suppliers")
public class MaterialSupplierController {

    @Autowired
    private IMaterialSupplierService servMatSup;

    @GetMapping
    public ResponseEntity<List<MaterialSupplierDTO>> getAllMaterialSuppliers() {
        List<MaterialSupplier> materialSupplierList = servMatSup.getAllMaterialSuppliers();
        List<MaterialSupplierDTO> materialSupplierDTOList = materialSupplierList.stream()
                .map(materialSupplier -> servMatSup.convertMaterialSupplierToDto(materialSupplier))
                .collect(Collectors.toList());
        return ResponseEntity.ok(materialSupplierDTOList);
    }

    @GetMapping("/{id}")
    public ResponseEntity<MaterialSupplierDTO> getMaterialSupplierById(@PathVariable Long id) {
        MaterialSupplier materialSupplier = servMatSup.getMaterialSupplierById(id);
        return ResponseEntity.ok(servMatSup.convertMaterialSupplierToDto(materialSupplier));
    }

    @PostMapping
    public ResponseEntity<MaterialSupplierDTO> createMaterialSupplier(@RequestBody @Valid MaterialSupplierCreateDTO dto) {
        MaterialSupplierDTO createdMaterialSupplier = servMatSup.createMaterialSupplier(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdMaterialSupplier);
    }

    @PutMapping
    public ResponseEntity<MaterialSupplierDTO> updateMaterialSupplier(@RequestBody @Valid MaterialSupplierUpdateDTO dto) {
        servMatSup.updateMaterialSupplier(dto);
        MaterialSupplier materialSupplier = servMatSup.getMaterialSupplierById(dto.getIdMaterialSupplier());
        return ResponseEntity.ok(servMatSup.convertMaterialSupplierToDto(materialSupplier));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMaterialSupplierById(@PathVariable Long id) {
        servMatSup.deleteMaterialSupplierById(id);
        return ResponseEntity.noContent().build();
    }
}
