package com.appTest.store.controllers;

import com.appTest.store.dto.saleDetail.MaterialMostSoldDTO;
import com.appTest.store.dto.saleDetail.SaleDetailDTO;
import com.appTest.store.models.SaleDetail;
import com.appTest.store.services.ISaleDetailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping ("/sale-details")
public class SaleDetailController {

    @Autowired
    private ISaleDetailService servMatSale;

    @GetMapping
    public ResponseEntity<List<SaleDetailDTO>> getAllSaleDetail() {
        List<SaleDetail> saleDetailList = servMatSale.getAllSaleDetail();

        List<SaleDetailDTO> materialSaleDTOList = saleDetailList.stream()
                .map(materialSale -> servMatSale.convertSaleDetailToDto(materialSale))
                .collect(Collectors.toList());

        return ResponseEntity.ok(materialSaleDTOList);
    }

    @GetMapping ("/{id}")
    public ResponseEntity<SaleDetailDTO> getSaleDetailById(@PathVariable Long id) {
        SaleDetail saleDetail = servMatSale.getSaleDetailById(id);
        if (saleDetail == null) {
            return ResponseEntity.notFound().build();
        }
        SaleDetailDTO materialSaleDTO = servMatSale.convertSaleDetailToDto(saleDetail);
        return ResponseEntity.ok(materialSaleDTO);
    }

    @GetMapping ("/material-most-sold")
    public ResponseEntity<MaterialMostSoldDTO> getMaterialMostSold() {
        MaterialMostSoldDTO materialMostSoldDTO = servMatSale.getMostSoldMaterial();
        return ResponseEntity.ok(materialMostSoldDTO);
    }

    @DeleteMapping ("/{id}")
    public ResponseEntity<String> deleteSaleDetailById (@PathVariable Long id) {
        boolean deleted = servMatSale.deleteSaleDetailById(id);
        if (deleted) {
            return ResponseEntity.ok("The sale detail has been successfully deleted.");
        }
        return ResponseEntity.notFound().build();
    }
}
