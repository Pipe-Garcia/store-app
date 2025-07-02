package com.appTest.store.controllers;

import com.appTest.store.dto.material.*;
import com.appTest.store.models.Material;
import com.appTest.store.services.IMaterialService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping ("/materials")
public class MaterialController {

    @Autowired
    private IMaterialService servMat;

    @GetMapping
    public ResponseEntity<List<MaterialDTO>> getAllMaterials() {
        List<Material> materialList = servMat.getAllMaterials();

        List<MaterialDTO> materialDTOList = materialList.stream()
                                            .map(material -> servMat.convertMaterialToDto(material))
                                            .collect(Collectors.toList());

        return ResponseEntity.ok(materialDTOList);
    }

    @GetMapping ("/{id}")
    public ResponseEntity<MaterialDTO> getMaterialById(@PathVariable Long id) {
        Material material = servMat.getMaterialById(id);
        if (material == null) {
            return ResponseEntity.notFound().build();
        }
        MaterialDTO materialDTO = servMat.convertMaterialToDto(material);
        return ResponseEntity.ok(materialDTO);
    }

    @GetMapping ("/stock-alert")
    public ResponseEntity<List<MaterialStockAlertDTO>> getMaterialsWithLowStock() {
        List<MaterialStockAlertDTO> materialStockAlertDTOList = servMat.getMaterialsWithLowStock();
        return ResponseEntity.ok(materialStockAlertDTOList);
    }

    @GetMapping ("/most-expensive")
    public ResponseEntity<MaterialMostExpensiveDTO> getMaterialByHighestPrice() {
        MaterialMostExpensiveDTO materialMostExpensiveDTO = servMat.getMaterialByHighestPrice();
        return ResponseEntity.ok(materialMostExpensiveDTO);
    }

    @PostMapping
    public ResponseEntity<String> createMaterial(@RequestBody @Valid MaterialCreateDTO dto) {
        servMat.createMaterial(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body("The material has been successfully created.");
    }

    @PutMapping
    public ResponseEntity<String> updateMaterial(@RequestBody MaterialUpdateDTO dto) {
        servMat.updateMaterial(dto);
        return ResponseEntity.ok().body("The material has been successfully updated.");
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteMaterialById(@PathVariable Long id) {
        boolean deleted = servMat.deleteMaterialById(id);
        if (deleted) {
            return ResponseEntity.ok("The material has been successfully deleted.");
        }
        return ResponseEntity.notFound().build();
    }

}
