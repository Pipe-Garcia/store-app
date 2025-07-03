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
    private ISaleDetailService servSaleDetail;

    @GetMapping
    public ResponseEntity<List<SaleDetailDTO>> getAllSaleDetail() {
        List<SaleDetail> saleDetailList = servSaleDetail.getAllSaleDetail();

        List<SaleDetailDTO> saleDetailDTOList = saleDetailList.stream()
                .map(saleDetail -> servSaleDetail.convertSaleDetailToDto(saleDetail))
                .collect(Collectors.toList());

        return ResponseEntity.ok(saleDetailDTOList);
    }

    @GetMapping ("/{id}")
    public ResponseEntity<SaleDetailDTO> getSaleDetailById(@PathVariable Long id) {
        SaleDetail saleDetail = servSaleDetail.getSaleDetailById(id);
        if (saleDetail == null) {
            return ResponseEntity.notFound().build();
        }
        SaleDetailDTO saleDetailDTO = servSaleDetail.convertSaleDetailToDto(saleDetail);
        return ResponseEntity.ok(saleDetailDTO);
    }

    @GetMapping ("/material-most-sold")
    public ResponseEntity<MaterialMostSoldDTO> getMaterialMostSold() {
        MaterialMostSoldDTO materialMostSoldDTO = servSaleDetail.getMostSoldMaterial();
        return ResponseEntity.ok(materialMostSoldDTO);
    }

    @DeleteMapping ("/{id}")
    public ResponseEntity<String> deleteSaleDetailById (@PathVariable Long id) {
        boolean deleted = servSaleDetail.deleteSaleDetailById(id);
        if (deleted) {
            return ResponseEntity.ok("The sale detail has been successfully deleted.");
        }
        return ResponseEntity.notFound().build();
    }
}
