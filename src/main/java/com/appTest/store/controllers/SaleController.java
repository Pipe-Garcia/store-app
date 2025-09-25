package com.appTest.store.controllers;

import com.appTest.store.dto.sale.*;
import com.appTest.store.models.Sale;
import com.appTest.store.repositories.ISaleRepository;
import com.appTest.store.services.ISaleService;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping ("/sales")
public class SaleController {

    @Autowired
    private ISaleService servSale;

    @Autowired
    private ISaleRepository repoSale;

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<SaleDTO>> getAllSales() {
        List<Sale> saleList = servSale.getAllSales();
        List<SaleDTO> saleDTOList = saleList.stream()
                                    .map(sale -> servSale.convertSaleToDto(sale))
                                    .collect(Collectors.toList());
        return ResponseEntity.ok(saleDTOList);
    }

    @GetMapping ("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<SaleDTO> getSaleById(@PathVariable Long id) {
        Sale sale = servSale.getSaleById(id);
        if (sale == null) {
            return ResponseEntity.notFound().build();
        }
        SaleDTO saleDTO = servSale.convertSaleToDto(sale);
        return ResponseEntity.ok(saleDTO);
    }

    @GetMapping ("/date/{date}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<SaleSummaryByDateDTO> getSaleSummaryByDate(@PathVariable @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        SaleSummaryByDateDTO saleSummaryByDateDTO = servSale.getSaleSummaryByDate(date);
        return ResponseEntity.ok(saleSummaryByDateDTO);
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<SaleDTO>> search(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long clientId,
            @RequestParam(required = false) String paymentStatus // PENDING|PARTIAL|PAID
    ) {
        List<Sale> list = servSale.search(from, to, clientId, paymentStatus);
        List<SaleDTO> dto = list.stream().map(servSale::convertSaleToDto).collect(Collectors.toList());
        return ResponseEntity.ok(dto);
    }

    @GetMapping ("/highest")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<SaleHighestDTO> getHighestSale() {
        SaleHighestDTO saleHighestDTO  = servSale.getHighestSale();
        if (saleHighestDTO == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(saleHighestDTO);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<SaleDTO> createSale(@RequestBody @Valid SaleCreateDTO dto) {
        SaleDTO createdSale = servSale.createSale(dto);
        return ResponseEntity.status(HttpStatus.CREATED).body(createdSale);
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<SaleDTO> updateSale(@RequestBody @Valid SaleUpdateDTO dto) {
        servSale.updateSale(dto);
        Sale sale = servSale.getSaleById(dto.getIdSale());
        return ResponseEntity.ok(servSale.convertSaleToDto(sale));
    }

    @DeleteMapping ("/{id}")
    @PreAuthorize("hasRole('ROLE_OWNER')")
    public ResponseEntity<String> deleteSale(@PathVariable Long id) {
        Sale sale = servSale.getSaleById(id);
        if (sale != null) {
            servSale.deleteSaleById(id);
            return ResponseEntity.ok().body("The sale has been successfully eliminated.");
        }
        return ResponseEntity.notFound().build();
    }
}
