package com.appTest.store.services;

import com.appTest.store.dto.material.*;
import com.appTest.store.models.Material;

import java.util.List;

public interface IMaterialService {

      List<Material> getAllMaterials(Boolean includeDeleted);

      MaterialDTO convertMaterialToDto(Material material);

      Material getMaterialById(Long idMaterial);

      List<MaterialStockAlertDTO> getMaterialsWithLowStock();

      MaterialMostExpensiveDTO getMaterialByHighestPrice();

      MaterialDTO createMaterial(MaterialCreateDTO dto);

      void updateMaterial(MaterialUpdateDTO dto);


      boolean deleteMaterialById(Long idMaterial);


      void restoreMaterial(Long idMaterial);
}

