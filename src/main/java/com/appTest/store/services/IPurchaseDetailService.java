package com.appTest.store.services;

import com.appTest.store.dto.purchaseDetail.PurchaseDetailDTO;
import com.appTest.store.models.PurchaseDetail;

import java.util.List;

public interface IPurchaseDetailService {
    List<PurchaseDetail> getAllPurchaseDetail();
    PurchaseDetail getPurchaseDetailById(Long id);
    PurchaseDetailDTO convertPurchaseDetailToDto(PurchaseDetail purchaseDetail);
    void deletePurchaseDetailById(Long id);
}
