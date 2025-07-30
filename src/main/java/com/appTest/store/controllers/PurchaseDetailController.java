package com.appTest.store.controllers;

import com.appTest.store.dto.purchaseDetail.PurchaseDetailDTO;
import com.appTest.store.models.PurchaseDetail;
import com.appTest.store.services.IPurchaseDetailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/purchase-details")
public class PurchaseDetailController {

    @Autowired
    private IPurchaseDetailService servPurchaseDetail;

    @GetMapping
    public ResponseEntity<List<PurchaseDetailDTO>> getAllPurchaseDetail() {
        List<PurchaseDetail> purchaseDetailList = servPurchaseDetail.getAllPurchaseDetail();
        List<PurchaseDetailDTO> purchaseDetailDTOList = purchaseDetailList.stream()
                .map(purchaseDetail -> servPurchaseDetail.convertPurchaseDetailToDto(purchaseDetail))
                .collect(Collectors.toList());
        return ResponseEntity.ok(purchaseDetailDTOList);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PurchaseDetailDTO> getPurchaseDetailById(@PathVariable Long id) {
        PurchaseDetail purchaseDetail = servPurchaseDetail.getPurchaseDetailById(id);
        return ResponseEntity.ok(servPurchaseDetail.convertPurchaseDetailToDto(purchaseDetail));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePurchaseDetailById(@PathVariable Long id) {
        servPurchaseDetail.deletePurchaseDetailById(id);
        return ResponseEntity.noContent().build();
    }
}
