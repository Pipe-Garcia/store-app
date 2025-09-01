package com.appTest.store.services;

import com.appTest.store.dto.materialSupplier.MaterialSupplierCreateDTO;
import com.appTest.store.dto.materialSupplier.MaterialSupplierDTO;
import com.appTest.store.dto.materialSupplier.MaterialSupplierUpdateDTO;
import com.appTest.store.models.Material;
import com.appTest.store.models.MaterialSupplier;
import com.appTest.store.models.Supplier;
import com.appTest.store.repositories.IMaterialRepository;
import com.appTest.store.repositories.IMaterialSupplierRepository;
import com.appTest.store.repositories.ISupplierRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class MaterialSupplierService implements IMaterialSupplierService{

    @Autowired
    private IMaterialSupplierRepository repoMatSup;

    @Autowired
    private IMaterialRepository repoMat;

    @Autowired
    private ISupplierRepository repoSup;

    @Override
    public List<MaterialSupplier> getAllMaterialSuppliers() {
        return repoMatSup.findAll();
    }

    @Override
    public MaterialSupplier getMaterialSupplierById(Long id) {
        return repoMatSup.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Material's supplier not found with ID: " + id));
    }

    @Override
    public MaterialSupplierDTO convertMaterialSupplierToDto(MaterialSupplier materialSupplier) {
        Long materialId = (materialSupplier.getMaterial() != null) ? materialSupplier.getMaterial().getIdMaterial() : null;
        String materialName = (materialSupplier.getMaterial() != null) ? materialSupplier.getMaterial().getName() : "Material's name not found";

        return new MaterialSupplierDTO(
                materialSupplier.getIdMaterialSupplier(),
                materialId,
                materialName,
                materialSupplier.getPriceUnit(),
                materialSupplier.getDeliveryTimeDays()
        );
    }


    @Override
    @Transactional
    public MaterialSupplierDTO createMaterialSupplier(MaterialSupplierCreateDTO dto) {

        MaterialSupplier materialSupplier = new MaterialSupplier();

        Material material = repoMat.findById(dto.getMaterialId())
                .orElseThrow(() -> new EntityNotFoundException("Material not found with ID: " + dto.getMaterialId()));
        materialSupplier.setMaterial(material);

        Supplier supplier = repoSup.findById(dto.getSupplierId())
                .orElseThrow(() -> new EntityNotFoundException("Supplier not found with ID: " + dto.getSupplierId()));
        materialSupplier.setSupplier(supplier);

        materialSupplier.setPriceUnit(dto.getPriceUnit());

        materialSupplier.setDeliveryTimeDays(dto.getDeliveryTimeDays());

        MaterialSupplier savedMaterialSupplier = repoMatSup.save(materialSupplier);
        savedMaterialSupplier = repoMatSup.findById(savedMaterialSupplier.getIdMaterialSupplier())
                .orElseThrow(() -> new EntityNotFoundException("Material's supplier not found after creation"));
        return convertMaterialSupplierToDto(savedMaterialSupplier);
    }

    @Override
    @Transactional
    public void updateMaterialSupplier(MaterialSupplierUpdateDTO dto) {
        MaterialSupplier materialSupplier = repoMatSup.findById(dto.getIdMaterialSupplier())
                .orElseThrow(() -> new EntityNotFoundException("Material's supplier not found with ID: " + dto.getIdMaterialSupplier()));

        if (materialSupplier != null) {
            if (dto.getPriceUnit() != null) materialSupplier.setPriceUnit(dto.getPriceUnit());
            if (dto.getDeliveryTimeDays() != null) materialSupplier.setDeliveryTimeDays(dto.getDeliveryTimeDays());
            repoMatSup.save(materialSupplier);
        }

    }

    @Override
    @Transactional
    public void deleteMaterialSupplierById(Long id) {
        repoMatSup.deleteById(id);
    }
}
