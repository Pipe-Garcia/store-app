package com.appTest.store.controllers;

import com.appTest.store.dto.sale.*;
import com.appTest.store.models.Sale;
import com.appTest.store.services.ISaleService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping ("/sales")
public class SaleController {

    @Autowired
    private ISaleService servSale;

    @GetMapping
    public ResponseEntity<List<SaleDTO>> getAllSales() {
        List<Sale> saleList = servSale.getAllSales();
        List<SaleDTO> saleDTOList = saleList.stream()
                                    .map(sale -> servSale.convertSaleToDto(sale))
                                    .collect(Collectors.toList());
        return ResponseEntity.ok(saleDTOList);
    }

    @GetMapping ("/{id}")
    public ResponseEntity<SaleDTO> getSaleById(@PathVariable Long id) {
        Sale sale = servSale.getSaleById(id);
        if (sale == null) {
            return ResponseEntity.notFound().build();
        }
        SaleDTO saleDTO = servSale.convertSaleToDto(sale);
        return ResponseEntity.ok(saleDTO);
    }

    @GetMapping ("/date/{date}")
    public ResponseEntity<SaleSummaryByDateDTO> getSaleSummaryByDate(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        SaleSummaryByDateDTO saleSummaryByDateDTO = servSale.getSaleSummaryByDate(date);
        return ResponseEntity.ok(saleSummaryByDateDTO);
    }

    @GetMapping ("/highest")
    public ResponseEntity<SaleHighestDTO> getHighestSale() {
        SaleHighestDTO saleHighestDTO  = servSale.getHighestSale();
        if (saleHighestDTO == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(saleHighestDTO);
    }

    @PostMapping
    public ResponseEntity<String> createSale(@RequestBody @Valid SaleCreateDTO dto) {
        servSale.createSale(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body("The sale has been successfully created.");
    }

    @PutMapping
    public ResponseEntity<String> updateSale(@RequestBody SaleUpdateDTO dto) {
        servSale.updateSale(dto);
        return ResponseEntity.ok().body("The sale has been successfully updated.");
    }

    @DeleteMapping ("/{id}")
    public ResponseEntity<String> deleteSale(@PathVariable Long id) {
        Sale sale = servSale.getSaleById(id);
        if (sale != null) {
            servSale.deleteSaleById(id);
            return ResponseEntity.ok().body("The sale has been successfully eliminated.");
        }
        return ResponseEntity.notFound().build();
    }
}
