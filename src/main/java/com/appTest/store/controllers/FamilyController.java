package com.appTest.store.controllers;

import com.appTest.store.dto.family.*;
import com.appTest.store.models.Family;
import com.appTest.store.repositories.IFamilyRepository;
import com.appTest.store.services.IFamilyService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/families")
public class FamilyController {

    @Autowired
    private IFamilyService servFam;

    @Autowired
    @Lazy
    private IFamilyRepository repoFam;

    @PostMapping
    public ResponseEntity<FamilyDTO> createFamily(@RequestBody @Valid FamilyCreateDTO dto) {
        FamilyDTO createdFamily = servFam.createFamily(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdFamily);
    }

    @PutMapping
    public ResponseEntity<FamilyDTO> updateFamily(@RequestBody @Valid FamilyUpdateDTO dto) {
        servFam.updateFamily(dto);
        Family family = repoFam.findById(dto.getIdFamily())
                .orElseThrow(() -> new EntityNotFoundException("Family not found"));
        return ResponseEntity.ok(servFam.convertFamilyToDto(family));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteFamilyById(@PathVariable Long id) {
        Family family = servFam.getFamilyById(id);

        if (family != null) {
            servFam.deleteFamilyById(id);
            return ResponseEntity.ok().body("The Family has been successfully eliminated.");
        }

        return ResponseEntity.notFound().build();
    }

    @GetMapping
    public ResponseEntity<List<FamilyDTO>> getAllFamilies() {
        List<Family> familyList = servFam.getAllFamilies();
        List<FamilyDTO> familyDTOList = familyList.stream()
                .map(family -> servFam.convertFamilyToDto(family))
                .collect(Collectors.toList());

        return ResponseEntity.ok(familyDTOList);
    }

    @GetMapping("/{id}")
    public ResponseEntity<FamilyDTO> getFamilyById(@PathVariable Long id) {

        Family family = servFam.getFamilyById(id);

        if (family == null) {
            return ResponseEntity.notFound().build();
        }

        FamilyDTO familyDTO = servFam.convertFamilyToDto(family);

        return ResponseEntity.ok(familyDTO);
    }
}

