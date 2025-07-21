package com.appTest.store.services;

import com.appTest.store.dto.material.*;
import com.appTest.store.models.Material;

import java.util.List;

public interface IMaterialService {

      public List<Material> getAllMaterials();

      public MaterialDTO convertMaterialToDto(Material material);

      public Material getMaterialById(Long idMaterial);

      public List<MaterialStockAlertDTO> getMaterialsWithLowStock();

      public MaterialMostExpensiveDTO getMaterialByHighestPrice();

      public MaterialDTO createMaterial(MaterialCreateDTO dto);

      public void updateMaterial(MaterialUpdateDTO dto);

      public boolean deleteMaterialById(Long idMaterial);
}
