package com.appTest.store.services;

import com.appTest.store.dto.material.*;
import com.appTest.store.models.Family;
import com.appTest.store.models.Material;
import com.appTest.store.models.Stock;
import com.appTest.store.repositories.IFamilyRepository;
import com.appTest.store.repositories.IMaterialRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;

@Service
public class MaterialService implements IMaterialService{

    @Autowired
    private IMaterialRepository repoMat;

    @Autowired
    @Lazy
    private IFamilyRepository repoFam;

    @Override
    public List<Material> getAllMaterials() {
        return repoMat.findAll();
    }

    @Override
    public MaterialDTO convertMaterialToDto(Material material) {
        BigDecimal totalQuantityAvailable = material.getStockList().stream()
                .map(Stock::getQuantityAvailable)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int totalSales = material.getSaleDetailList().stream()
                .mapToInt(sd -> sd.getQuantity().intValue()) // Suma de cantidades vendidas
                .sum();

        String category = material.getFamily().getTypeFamily();
        return new MaterialDTO(
                material.getIdMaterial(),
                material.getName(),
                material.getBrand(),
                material.getPriceArs(),
                material.getPriceUsd(),
                material.getMeasurementUnit(),
                material.getInternalNumber(),
                material.getDescription(),
                category,
                totalQuantityAvailable,
                totalSales,
                material.getStockList().size(),
                material.getMaterialSuppliers().size(),
                material.getSaleDetailList().size(),
                material.getOrderDetails().size()
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
        material.setDescription(dto.getDescription());

        Family family = repoFam.findById(dto.getFamilyId())
                .orElseThrow(() -> new RuntimeException("Family not found with ID: " + dto.getFamilyId()));
        material.setFamily(family);

        repoMat.save(material);
    }

    @Override
    public void updateMaterial(MaterialUpdateDTO dto) {
        Material material = repoMat.findById(dto.getIdMaterial())
                .orElseThrow(() -> new RuntimeException("Material not found with ID: " + dto.getIdMaterial()));

        if (dto.getName() != null) material.setName(dto.getName());
        if (dto.getBrand() != null) material.setBrand(dto.getBrand());
        if (dto.getPriceArs() != null) material.setPriceArs(dto.getPriceArs());
        if (dto.getPriceUsd() != null) material.setPriceUsd(dto.getPriceUsd());
        if (dto.getMeasurementUnit() != null) material.setMeasurementUnit(dto.getMeasurementUnit());
        if (dto.getDescription() != null) material.setDescription(dto.getDescription());
        if (dto.getInternalNumber() != null) material.setInternalNumber(dto.getInternalNumber());

        if (dto.getFamilyId() != null) {
            Family family = repoFam.findById(dto.getFamilyId())
                    .orElseThrow(() -> new RuntimeException("Family not found with ID: " + dto.getFamilyId()));
            material.setFamily(family);
        }

        repoMat.save(material);
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
