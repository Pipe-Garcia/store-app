package com.appTest.store.services;

import com.appTest.store.audit.Auditable;
import com.appTest.store.dto.material.*;
import com.appTest.store.models.Family;
import com.appTest.store.models.Material;
import com.appTest.store.models.Stock;
import com.appTest.store.models.Warehouse;
import com.appTest.store.repositories.IFamilyRepository;
import com.appTest.store.repositories.IMaterialRepository;
import com.appTest.store.repositories.IStockRepository;
import com.appTest.store.repositories.IWarehouseRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class MaterialService implements IMaterialService{

    @Autowired
    private IMaterialRepository repoMat;

    @Autowired
    
    private IFamilyRepository repoFam;

    @Autowired
    
    private IWarehouseRepository repoWare;

    @Autowired
    
    private IStockRepository repoStock;

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
                .mapToInt(sd -> sd.getQuantity().intValue())
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
    @Transactional
    @Auditable(entity="Material", action="CREATE")
    public MaterialDTO createMaterial(MaterialCreateDTO dto) {

        Material material = new Material();

        material.setName(dto.getName());
        material.setBrand(dto.getBrand());
        material.setPriceArs(dto.getPriceArs());
        material.setPriceUsd(dto.getPriceUsd());
        material.setMeasurementUnit(dto.getMeasurementUnit());
        material.setInternalNumber(dto.getInternalNumber());
        material.setDescription(dto.getDescription());

        Family family = repoFam.findById(dto.getFamilyId())
                .orElseThrow(() -> new EntityNotFoundException("Family not found with ID: " + dto.getFamilyId()));
        material.setFamily(family);

        Material savedMaterial = repoMat.save(material);

        Warehouse warehouse = null;
        if (dto.getWarehouse() != null) {
            warehouse = new Warehouse();
            warehouse.setAddress(dto.getWarehouse().getAddress());
            warehouse.setName(dto.getWarehouse().getName());
            warehouse.setLocation(dto.getWarehouse().getLocation());
            warehouse = repoWare.save(warehouse);
        }

        if (dto.getStock() != null) {
            Stock stock = new Stock();
            stock.setMaterial(savedMaterial);
            stock.setWarehouse(warehouse != null ? warehouse : repoWare.findById(dto.getStock().getWarehouseId())
                    .orElseThrow(() -> new EntityNotFoundException("Warehouse not found")));
            stock.setQuantityAvailable(dto.getStock().getQuantityAvailable());
            stock.setLastUpdate(LocalDate.now());
            repoStock.save(stock);
            savedMaterial = repoMat.findById(savedMaterial.getIdMaterial())
                    .orElseThrow(() -> new EntityNotFoundException("Material not found after stock creation"));
        }

        savedMaterial = repoMat.findById(savedMaterial.getIdMaterial())
                .orElseThrow(() -> new EntityNotFoundException("Material not found after creation"));
        return convertMaterialToDto(savedMaterial);
    }

    private String norm(String s){
        return s==null? null : s.trim();
    }

    private boolean hasText(String s){
        return s!=null && !s.trim().isEmpty();
    }

    @Override
    @Transactional
    @Auditable(entity="Material", action="UPDATE", idParam="dto.idMaterial")
    public void updateMaterial(MaterialUpdateDTO dto) {
        Material material = repoMat.findById(dto.getIdMaterial())
                .orElseThrow(() -> new EntityNotFoundException("Material not found with ID: " + dto.getIdMaterial()));

        if (hasText(dto.getName())) material.setName(norm(dto.getName()));
        if (hasText(dto.getBrand())) material.setBrand(norm(dto.getBrand()));
        if (dto.getPriceArs() != null) material.setPriceArs(dto.getPriceArs());
        if (dto.getPriceUsd() != null) material.setPriceUsd(dto.getPriceUsd());
        if (hasText(dto.getInternalNumber())) material.setInternalNumber(norm(dto.getInternalNumber()));
        if (hasText(dto.getMeasurementUnit())) material.setMeasurementUnit(norm(dto.getMeasurementUnit()));
        if (dto.getDescription()!=null) material.setDescription(norm(dto.getDescription()));

        if (dto.getFamilyId() != null) {
            Family family = repoFam.findById(dto.getFamilyId())
                    .orElseThrow(() -> new EntityNotFoundException("Family not found with ID: " + dto.getFamilyId()));
            material.setFamily(family);
        }

        repoMat.save(material);
    }


    @Override
    @Transactional
    @Auditable(entity="Material", action="DELETE", idParam="id")
    public boolean deleteMaterialById(Long idMaterial) {
        Material material = repoMat.findById(idMaterial).orElse(null);
        if (material != null) {
            repoMat.delete(material);
            return true;
        }
        return false;
    }

}
