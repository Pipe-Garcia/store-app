package com.appTest.store.controllers;

import com.appTest.store.dto.saleDetail.MaterialMostSoldDTO;
import com.appTest.store.dto.saleDetail.SaleDetailDTO;
import com.appTest.store.models.SaleDetail;
import com.appTest.store.services.ISaleDetailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping ("/sale-details")
public class SaleDetailController {

    @Autowired
    private ISaleDetailService servSaleDetail;

    @GetMapping
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<SaleDetailDTO>> getAllSaleDetail() {
        List<SaleDetail> saleDetailList = servSaleDetail.getAllSaleDetail();

        List<SaleDetailDTO> saleDetailDTOList = saleDetailList.stream()
                .map(saleDetail -> servSaleDetail.convertSaleDetailToDto(saleDetail))
                .collect(Collectors.toList());

        return ResponseEntity.ok(saleDetailDTOList);
    }

    @GetMapping ("/{id}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<SaleDetailDTO> getSaleDetailById(@PathVariable Long id) {
        SaleDetail saleDetail = servSaleDetail.getSaleDetailById(id);
        if (saleDetail == null) {
            return ResponseEntity.notFound().build();
        }
        SaleDetailDTO saleDetailDTO = servSaleDetail.convertSaleDetailToDto(saleDetail);
        return ResponseEntity.ok(saleDetailDTO);
    }

    @GetMapping("/by-sale/{saleId}")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<List<SaleDetailDTO>> bySale(@PathVariable Long saleId) {
        return ResponseEntity.ok(servSaleDetail.findBySaleId(saleId));
    }

    @GetMapping ("/material-most-sold")
    @PreAuthorize("hasAnyRole('ROLE_EMPLOYEE','ROLE_OWNER')")
    public ResponseEntity<MaterialMostSoldDTO> getMaterialMostSold() {
        MaterialMostSoldDTO materialMostSoldDTO = servSaleDetail.getMostSoldMaterial();
        return ResponseEntity.ok(materialMostSoldDTO);
    }

    @DeleteMapping ("/{id}")
    @PreAuthorize("hasRole('ROLE_OWNER')")
    public ResponseEntity<String> deleteSaleDetailById (@PathVariable Long id) {
        boolean deleted = servSaleDetail.deleteSaleDetailById(id);
        if (deleted) {
            return ResponseEntity.ok("The sale detail has been successfully deleted.");
        }
        return ResponseEntity.notFound().build();
    }
}
