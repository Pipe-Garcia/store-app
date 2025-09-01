package com.appTest.store.services;

import com.appTest.store.dto.stock.StockByWarehouseDTO;
import com.appTest.store.dto.stock.StockCreateDTO;
import com.appTest.store.dto.stock.StockDTO;
import com.appTest.store.dto.stock.StockUpdateDTO;
import com.appTest.store.models.Stock;

import java.math.BigDecimal;
import java.util.List;

public interface IStockService {
    List<Stock> getAllStocks();
    List<Stock> getStocksByMaterial(Long materialId);
    Stock getStockById(Long id);
    StockDTO convertStockToDto(Stock stock);
    StockDTO createStock(StockCreateDTO dto);
    void updateStock(StockUpdateDTO dto);
    void deleteStockById(Long id);
    void decreaseStock(Long materialId, Long warehouseId, BigDecimal quantity);
    void increaseStock(Long materialId, Long warehouseId, BigDecimal quantity);
    List<StockByWarehouseDTO> byMaterial(Long materialId);
}
