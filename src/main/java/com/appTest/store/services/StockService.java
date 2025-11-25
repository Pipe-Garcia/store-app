// src/main/java/com/appTest/store/services/StockService.java
package com.appTest.store.services;

import com.appTest.store.audit.Auditable;
import com.appTest.store.dto.stock.*;
import com.appTest.store.models.Material;
import com.appTest.store.models.Stock;
import com.appTest.store.models.Warehouse;
import com.appTest.store.repositories.IMaterialRepository;
import com.appTest.store.repositories.IStockRepository;
import com.appTest.store.repositories.IStockReservationRepository;
import com.appTest.store.repositories.IWarehouseRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Service
public class StockService implements IStockService {

    @Autowired private IStockRepository repoStock;
    @Autowired private IMaterialRepository repoMat;
    @Autowired private IWarehouseRepository repoWare;
    @Autowired private IStockReservationRepository repoReservation;

    // NUEVO: logger de histórico
    @Autowired private StockMovementService movement;

    @Override
    public List<Stock> getAllStocks() {
        return repoStock.findAll();
    }

    @Override
    public Stock getStockById(Long id) {
        return repoStock.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Stock not found with ID: " + id));
    }

    @Override
    public StockDTO convertStockToDto(Stock stock) {
        return new StockDTO(
                stock.getIdStock(),
                stock.getMaterial().getIdMaterial(),
                stock.getMaterial().getName(),
                stock.getWarehouse().getName(),
                stock.getQuantityAvailable(),
                stock.getLastUpdate()
        );
    }

    @Override
    public List<StockByWarehouseDTO> byMaterial(Long materialId) {
        return repoStock.findByMaterialId(materialId);
    }

    @Override
    public BigDecimal availability(Long materialId, Long warehouseId) {
        return repoStock.findByMaterial_IdMaterialAndWarehouse_IdWarehouse(materialId, warehouseId)
                .map(Stock::getQuantityAvailable)
                .orElse(BigDecimal.ZERO);
    }

    @Override
    public BigDecimal reserved(Long materialId, Long warehouseId) {
        return repoReservation.sumActiveByMaterialWarehouse(materialId, warehouseId);
    }

    @Override
    public BigDecimal availableForReservation(Long materialId, Long warehouseId) {
        BigDecimal onHand    = availability(materialId, warehouseId);
        BigDecimal active    = repoReservation.sumActiveByMaterialWarehouse(materialId, warehouseId);
        BigDecimal allocated = repoReservation.sumAllocatedByMaterialWarehouse(materialId, warehouseId);
        return onHand.subtract(active).subtract(allocated);
    }

    @Override
    public List<Stock> getStocksByWarehouse(Long warehouseId) {
        return repoStock.findByWarehouse_IdWarehouse(warehouseId);
    }

    @Override
    @Transactional
    @Auditable(entity="Stock", action="CREATE")
    public StockDTO createStock(StockCreateDTO dto) {
        Material material = repoMat.findById(dto.getMaterialId())
                .orElseThrow(() -> new EntityNotFoundException("Material not found with ID: " + dto.getMaterialId()));

        Warehouse warehouse = repoWare.findById(dto.getWarehouseId())
                .orElseThrow(() -> new EntityNotFoundException("Warehouse not found with ID: " + dto.getWarehouseId()));

        Stock stock = new Stock();
        stock.setMaterial(material);
        stock.setWarehouse(warehouse);
        stock.setQuantityAvailable(dto.getQuantityAvailable());
        stock.setLastUpdate(LocalDate.now());
        repoStock.save(stock);

        // LOG: alta/ajuste inicial
        movement.logChange(
                material.getIdMaterial(), material.getName(),
                warehouse.getIdWarehouse(), warehouse.getName(),
                BigDecimal.ZERO, stock.getQuantityAvailable(),
                "ADJUST", "STOCK", stock.getIdStock(),
                "Alta de stock"
        );

        return convertStockToDto(stock);
    }


    @Override
    @Transactional
    @Auditable(entity="Stock", action="UPDATE", idParam = "dto.idStock")
    public void updateStock(StockUpdateDTO dto) {
        Stock stock = repoStock.findById(dto.getIdStock())
                .orElseThrow(() -> new EntityNotFoundException("Stock not found with ID: " + dto.getIdStock()));

        if (dto.getQuantityAvailable() != null) {
            var before = stock.getQuantityAvailable();
            stock.setQuantityAvailable(dto.getQuantityAvailable());
            stock.setLastUpdate(LocalDate.now());
            repoStock.save(stock);

            // Registrar movimiento (motivo ADJUST, origen STOCK)
            try {
                String note = stock.getMaterial().getName() + " — " +
                        before.stripTrailingZeros().toPlainString() + " → " +
                        stock.getQuantityAvailable().stripTrailingZeros().toPlainString();
                movement.logChange(
                        stock.getMaterial().getIdMaterial(),
                        stock.getMaterial().getName(),
                        stock.getWarehouse().getIdWarehouse(),
                        stock.getWarehouse().getName(),
                        before,
                        stock.getQuantityAvailable(),
                        "ADJUST", "STOCK", stock.getIdStock(),
                        note
                );
            } catch (Exception ignored) { /* best-effort */ }
        }
    }

    @Override
    @Transactional
    @Auditable(entity="Stock", action="DELETE", idParam="id")
    public void deleteStockById(Long id) {
        Stock stock = repoStock.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Stock not found with ID: " + id));

        BigDecimal from = stock.getQuantityAvailable();

        repoStock.deleteById(id);

        // LOG: baja
        movement.logChange(
                stock.getMaterial().getIdMaterial(), stock.getMaterial().getName(),
                stock.getWarehouse().getIdWarehouse(), stock.getWarehouse().getName(),
                from, BigDecimal.ZERO,
                "ADJUST", "STOCK", id,
                "Eliminación de registro de stock"
        );
    }

    @Override
    @Transactional
    public void decreaseStock(Long materialId, Long warehouseId, BigDecimal quantity) {
        Stock stock = repoStock.findByMaterial_IdMaterialAndWarehouse_IdWarehouse(materialId, warehouseId)
                .orElseThrow(() -> new EntityNotFoundException("Stock not found"));
        BigDecimal from = stock.getQuantityAvailable();
        if (from.compareTo(quantity) < 0) throw new IllegalStateException("Not enough stock available.");

        stock.setQuantityAvailable(from.subtract(quantity));
        stock.setLastUpdate(LocalDate.now());
        repoStock.save(stock);

        // LOG: salida
        movement.logChange(
                stock.getMaterial().getIdMaterial(), stock.getMaterial().getName(),
                stock.getWarehouse().getIdWarehouse(), stock.getWarehouse().getName(),
                from, stock.getQuantityAvailable(),
                "SALE", "STOCK", stock.getIdStock(),
                "Disminución de stock"
        );
    }

    @Override
    public List<Stock> getStocksByMaterial(Long materialId) {
        return repoStock.findByMaterial_IdMaterial(materialId);
    }

    @Override
    @Transactional
    public void increaseStock(Long materialId, Long warehouseId, BigDecimal quantity) {
        Stock stock = repoStock.findByMaterial_IdMaterialAndWarehouse_IdWarehouse(materialId, warehouseId)
                .orElseThrow(() -> new EntityNotFoundException("Stock not found"));

        BigDecimal from = stock.getQuantityAvailable();
        stock.setQuantityAvailable(from.add(quantity));
        stock.setLastUpdate(LocalDate.now());
        repoStock.save(stock);

        // LOG: ingreso
        movement.logChange(
                stock.getMaterial().getIdMaterial(), stock.getMaterial().getName(),
                stock.getWarehouse().getIdWarehouse(), stock.getWarehouse().getName(),
                from, stock.getQuantityAvailable(),
                "DELIVERY", "STOCK", stock.getIdStock(),
                "Aumento de stock"
        );
    }
}

