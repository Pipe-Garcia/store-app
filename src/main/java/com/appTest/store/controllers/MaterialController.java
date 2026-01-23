package com.appTest.store.controllers;

import com.appTest.store.dto.material.*;
import com.appTest.store.models.Material;
import com.appTest.store.repositories.IMaterialRepository;
import com.appTest.store.services.IMaterialService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/materials")
public class MaterialController {

    @Autowired
    private IMaterialService servMat;

    @Autowired
    private IMaterialRepository repoMat;

    // GET con filtro de eliminados (igual que clientes/proveedores)
    @GetMapping
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<MaterialDTO>> getAllMaterials(
            @RequestParam(required = false) Boolean includeDeleted
    ) {
        List<Material> materialList = servMat.getAllMaterials(includeDeleted);

        List<MaterialDTO> materialDTOList = materialList.stream()
                .map(servMat::convertMaterialToDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(materialDTOList);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<MaterialDTO> getMaterialById(@PathVariable Long id) {
        Material material = servMat.getMaterialById(id);
        if (material == null) {
            return ResponseEntity.notFound().build();
        }
        MaterialDTO materialDTO = servMat.convertMaterialToDto(material);
        return ResponseEntity.ok(materialDTO);
    }

    @GetMapping("/stock-alert")
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<MaterialStockAlertDTO>> getMaterialsWithLowStock() {
        List<MaterialStockAlertDTO> materialStockAlertDTOList = servMat.getMaterialsWithLowStock();
        return ResponseEntity.ok(materialStockAlertDTOList);
    }

    @GetMapping("/most-expensive")
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<MaterialMostExpensiveDTO> getMaterialByHighestPrice() {
        MaterialMostExpensiveDTO materialMostExpensiveDTO = servMat.getMaterialByHighestPrice();
        return ResponseEntity.ok(materialMostExpensiveDTO);
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<MaterialDTO>> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long familyId,
            @RequestParam(required = false) BigDecimal minPrice,
            @RequestParam(required = false) BigDecimal maxPrice,
            @RequestParam(required = false, defaultValue = "false") boolean includeDeleted
    ) {
        var list = repoMat.search(
                (q != null && !q.isBlank()) ? q : null,
                familyId,
                minPrice,
                maxPrice,
                includeDeleted
        );

        return ResponseEntity.ok(
                list.stream()
                        .map(servMat::convertMaterialToDto)
                        .toList()
        );
    }


    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<MaterialDTO> createMaterial(@RequestBody @Valid MaterialCreateDTO dto) {
        MaterialDTO createdMaterial =  servMat.createMaterial(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdMaterial);
    }

    @PutMapping
    @PreAuthorize("hasAnyAuthority('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<MaterialDTO> updateMaterial(@RequestBody @Valid MaterialUpdateDTO dto) {
        servMat.updateMaterial(dto);
        Material material = servMat.getMaterialById(dto.getIdMaterial());
        return ResponseEntity.ok(servMat.convertMaterialToDto(material));
    }

    // Soft delete
    @DeleteMapping("/{id}")
    @PreAuthorize("hasAuthority('ROLE_OWNER')")
    public ResponseEntity<String> deleteMaterialById(@PathVariable Long id) {
        boolean deleted = servMat.deleteMaterialById(id);
        if (deleted) {
            return ResponseEntity.ok("The material has been disabled (Soft Delete).");
        }
        return ResponseEntity.notFound().build();
    }

    // RESTORE
    @PutMapping("/{id}/restore")
    @PreAuthorize("hasAuthority('ROLE_OWNER')")
    public ResponseEntity<String> restoreMaterial(@PathVariable Long id) {
        Material material = servMat.getMaterialById(id);
        if (material == null) {
            return ResponseEntity.notFound().build();
        }
        servMat.restoreMaterial(id);
        return ResponseEntity.ok("The material has been restored successfully.");
    }
}
