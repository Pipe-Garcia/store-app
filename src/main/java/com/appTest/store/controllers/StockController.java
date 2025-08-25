package com.appTest.store.controllers;

import com.appTest.store.dto.stock.StockCreateDTO;
import com.appTest.store.dto.stock.StockDTO;
import com.appTest.store.dto.stock.StockUpdateDTO;
import com.appTest.store.models.Stock;
import com.appTest.store.services.IStockService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/stocks")
public class StockController {

    @Autowired
    private IStockService servStock;

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<StockDTO>> getStocks(@RequestParam(required = false) Long materialId) {
        List<Stock> stockList;

        if (materialId != null) {
            stockList = servStock.getStocksByMaterial(materialId);
        } else {
            stockList = servStock.getAllStocks();
        }

        List<StockDTO> stockDTOList = stockList.stream()
                .map(servStock::convertStockToDto)
                .collect(Collectors.toList());

        return ResponseEntity.ok(stockDTOList);
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<StockDTO> getStockById(@PathVariable Long id) {
        Stock stock = servStock.getStockById(id);
        if (stock == null) {
            return ResponseEntity.notFound().build();
        }
        StockDTO stockDTO = servStock.convertStockToDto(stock);
        return ResponseEntity.ok(stockDTO);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<StockDTO> createStock(@RequestBody @Valid StockCreateDTO dto) {
        StockDTO createdStock = servStock.createStock(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdStock);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<StockDTO> updateStock(@RequestBody @Valid StockUpdateDTO dto) {
        servStock.updateStock(dto);
        Stock stock = servStock.getStockById(dto.getIdStock());
        return ResponseEntity.ok(servStock.convertStockToDto(stock));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ROLE_OWNER')")
    public ResponseEntity<String> deleteStockById(@PathVariable Long id) {
        Stock stock = servStock.getStockById(id);
        if (stock != null) {
            servStock.deleteStockById(id);
            return ResponseEntity.ok().body("The Stock has been successfully deleted.");
        }
        return ResponseEntity.notFound().build();
    }
}
