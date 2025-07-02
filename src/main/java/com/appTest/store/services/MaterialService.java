package com.appTest.store.services;

import com.appTest.store.dto.material.*;
import com.appTest.store.models.Material;
import com.appTest.store.repositories.IMaterialRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class MaterialService implements IMaterialService{

    @Autowired
    private IMaterialRepository repoMat;

    @Override
    public List<Material> getAllMaterials() {
        return repoMat.findAll();
    }

    @Override
    public MaterialDTO convertMaterialToDto(Material material) {
        int totalSales = (material.getSaleDetailList() != null) ? material.getSaleDetailList().size() : 0;

        return new MaterialDTO(
                material.getBrand(),
                material.getName(),
                material.getPriceArs(),
                totalSales
        );
    }

    @Override
    public Material getMaterialById(Long idMaterial) {
        return repoMat.findById(idMaterial).orElse(null);
    }

    @Override
    public List<MaterialStockAlertDTO> getMaterialsWithLowStock() {
        return repoMat.getMaterialsWithLowStock();
    }

    @Override
    public MaterialMostExpensiveDTO getMaterialByHighestPrice() {
        List<MaterialMostExpensiveDTO> list = repoMat.getMaterialByHighestPrice();
        return list.isEmpty() ? null : list.get(0);
    }

    @Override
    public void createMaterial(MaterialCreateDTO dto) {
        Material material = new Material();
        material.setName(dto.getName());
        material.setBrand(dto.getBrand());
        material.setPriceArs(dto.getPriceArs());
        material.setPriceUsd(dto.getPriceUsd());
        material.setMeasurementUnit(dto.getMeasurementUnit());
        material.setInternalNumber(dto.getInternalNumber());

        repoMat.save(material);
    }

    @Override
    public void updateMaterial(MaterialUpdateDTO dto) {
        Material material = repoMat.findById(dto.getIdMaterial()).orElse(null);

        if (material != null) {
            if (dto.getName() != null) material.setName(dto.getName());
            if (dto.getBrand() != null) material.setBrand(dto.getBrand());
            if (dto.getPrice() != null) material.setPriceArs(dto.getPrice());
            repoMat.save(material);
        }
    }

    @Override
    public boolean deleteMaterialById(Long idMaterial) {
        Material material = repoMat.findById(idMaterial).orElse(null);
        if (material != null) {
            repoMat.delete(material);
            return true;
        }
        return false;
    }

}
