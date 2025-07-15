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
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/stocks")
public class StockController {

    @Autowired
    private IStockService servStock;

    @GetMapping
    public ResponseEntity<List<StockDTO>> getAllStocks() {
        List<Stock> stockList = servStock.getAllStocks();

        List<StockDTO> stockDTOList = stockList.stream()
                .map(stock -> servStock.convertStockToDto(stock))
                .collect(Collectors.toList());

        return ResponseEntity.ok(stockDTOList);
    }

    @GetMapping("/{id}")
    public ResponseEntity<StockDTO> getStockById(@PathVariable Long id) {
        Stock stock = servStock.getStockById(id);
        if (stock == null) {
            return ResponseEntity.notFound().build();
        }
        StockDTO stockDTO = servStock.convertStockToDto(stock);
        return ResponseEntity.ok(stockDTO);
    }

    @PostMapping
    public ResponseEntity<StockDTO> createStock(@RequestBody @Valid StockCreateDTO dto) {
        StockDTO createdStock = servStock.createStock(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdStock);
    }

    @PutMapping
    public ResponseEntity<StockDTO> updateStock(@RequestBody @Valid StockUpdateDTO dto) {
        servStock.updateStock(dto);
        Stock stock = servStock.getStockById(dto.getIdStock());
        return ResponseEntity.ok(servStock.convertStockToDto(stock));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<String> deleteStockById(@PathVariable Long id) {
        Stock stock = servStock.getStockById(id);
        if (stock != null) {
            servStock.deleteStockById(id);
            return ResponseEntity.ok().body("The Stock has been successfully deleted.");
        }
        return ResponseEntity.notFound().build();
    }
}
