package com.appTest.store.controllers;

import com.appTest.store.dto.material.*;
import com.appTest.store.models.Material;
import com.appTest.store.services.IMaterialService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping ("/materials")
public class MaterialController {

    @Autowired
    private IMaterialService servMat;

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<MaterialDTO>> getAllMaterials() {
        List<Material> materialList = servMat.getAllMaterials();

        List<MaterialDTO> materialDTOList = materialList.stream()
                                            .map(material -> servMat.convertMaterialToDto(material))
                                            .collect(Collectors.toList());

        return ResponseEntity.ok(materialDTOList);
    }

    @GetMapping ("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<MaterialDTO> getMaterialById(@PathVariable Long id) {
        Material material = servMat.getMaterialById(id);
        if (material == null) {
            return ResponseEntity.notFound().build();
        }
        MaterialDTO materialDTO = servMat.convertMaterialToDto(material);
        return ResponseEntity.ok(materialDTO);
    }

    @GetMapping ("/stock-alert")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<MaterialStockAlertDTO>> getMaterialsWithLowStock() {
        List<MaterialStockAlertDTO> materialStockAlertDTOList = servMat.getMaterialsWithLowStock();
        return ResponseEntity.ok(materialStockAlertDTOList);
    }

    @GetMapping ("/most-expensive")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<MaterialMostExpensiveDTO> getMaterialByHighestPrice() {
        MaterialMostExpensiveDTO materialMostExpensiveDTO = servMat.getMaterialByHighestPrice();
        return ResponseEntity.ok(materialMostExpensiveDTO);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<MaterialDTO> createMaterial(@RequestBody @Valid MaterialCreateDTO dto) {
        MaterialDTO createdMaterial =  servMat.createMaterial(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdMaterial);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<MaterialDTO> updateMaterial(@RequestBody @Valid MaterialUpdateDTO dto) {
        servMat.updateMaterial(dto);
        Material material = servMat.getMaterialById(dto.getIdMaterial());
        return ResponseEntity.ok(servMat.convertMaterialToDto(material));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_OWNER')")
    public ResponseEntity<String> deleteMaterialById(@PathVariable Long id) {
        boolean deleted = servMat.deleteMaterialById(id);
        if (deleted) {
            return ResponseEntity.ok("The material has been successfully deleted.");
        }
        return ResponseEntity.notFound().build();
    }

}
