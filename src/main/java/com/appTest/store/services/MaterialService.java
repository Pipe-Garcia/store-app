package com.appTest.store.services;

import com.appTest.store.dto.material.*;
import com.appTest.store.models.Material;
import com.appTest.store.models.Stock;
import com.appTest.store.repositories.IMaterialRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
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
        BigDecimal totalQuantityAvailable = material.getStockList().stream()
                .map(Stock::getQuantityAvailable)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int totalSales = material.getSaleDetailList().stream()
                .mapToInt(sd -> sd.getQuantity().intValue()) // Suma de cantidades vendidas
                .sum();

        return new MaterialDTO(
                material.getName(),
                material.getBrand(),
                material.getPriceArs(), // O priceUsd según prefieras
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
        material.setFamily(dto.getFamilyId());

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
