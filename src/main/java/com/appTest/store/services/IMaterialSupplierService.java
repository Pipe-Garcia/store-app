package com.appTest.store.services;

import com.appTest.store.dto.materialSupplier.MaterialSupplierCreateDTO;
import com.appTest.store.dto.materialSupplier.MaterialSupplierDTO;
import com.appTest.store.dto.materialSupplier.MaterialSupplierUpdateDTO;
import com.appTest.store.models.MaterialSupplier;

import java.util.List;

public interface IMaterialSupplierService {
    List<MaterialSupplier> getAllMaterialSuppliers();
    MaterialSupplier getMaterialSupplierById(Long id);
    MaterialSupplierDTO convertMaterialSupplierToDto(MaterialSupplier materialSupplier);
    MaterialSupplierDTO createMaterialSupplier(MaterialSupplierCreateDTO dto);
    void updateMaterialSupplier(MaterialSupplierUpdateDTO dto);
    void deleteMaterialSupplierById(Long id);
}
