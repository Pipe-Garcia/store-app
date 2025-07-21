package com.appTest.store.services;

import com.appTest.store.dto.stock.StockCreateDTO;
import com.appTest.store.dto.stock.StockDTO;
import com.appTest.store.dto.stock.StockUpdateDTO;
import com.appTest.store.models.Material;
import com.appTest.store.models.Stock;
import com.appTest.store.models.Warehouse;
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
public class StockService implements IStockService{

    @Autowired
    private IStockRepository repoStock;

    @Autowired
    
    private IMaterialRepository repoMat;

    @Autowired
    
    private IWarehouseRepository repoWare;

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

        String nameMaterial = stock.getMaterial().getName();
        String nameWarehouse = stock.getWarehouse().getName();

        return new StockDTO(
            stock.getIdStock(),
            nameMaterial,
                nameWarehouse,
            stock.getQuantityAvailable(),
                stock.getLastUpdate()
        );
    }

    @Override
    @Transactional
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
        return convertStockToDto(stock);
    }

    @Override
    @Transactional
    public void updateStock(StockUpdateDTO dto) {
        Stock stock = repoStock.findById(dto.getIdStock())
                .orElseThrow(() -> new EntityNotFoundException("Stock not found with ID: " + dto.getIdStock()));

        if (dto.getQuantityAvailable() != null) {
            stock.setQuantityAvailable(dto.getQuantityAvailable());
            stock.setLastUpdate(LocalDate.now());
        }

        repoStock.save(stock);
    }

    @Override
    @Transactional
    public void deleteStockById(Long id) {
        repoStock.deleteById(id);
    }

    @Override
    public void decreaseStock(Long materialId, Long warehouseId, BigDecimal quantity) {
        Stock stock = repoStock.findByMaterial_IdMaterialAndWarehouse_IdWarehouse(materialId, warehouseId)
                .orElseThrow(() -> new EntityNotFoundException("Stock not found"));
        if (stock.getQuantityAvailable().compareTo(quantity) < 0) {
            throw new IllegalStateException("Not enough stock available.");
        }
        stock.setQuantityAvailable(stock.getQuantityAvailable().subtract(quantity));
        repoStock.save(stock);
    }

    @Override
    public void increaseStock(Long materialId, Long warehouseId, BigDecimal quantity) {
        Stock stock = repoStock.findByMaterial_IdMaterialAndWarehouse_IdWarehouse(materialId, warehouseId)
                .orElseThrow(() -> new EntityNotFoundException("Stock not found"));
        stock.setQuantityAvailable(stock.getQuantityAvailable().add(quantity));
        repoStock.save(stock);
    }

}
