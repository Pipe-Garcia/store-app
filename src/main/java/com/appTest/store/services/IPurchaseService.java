package com.appTest.store.services;

import com.appTest.store.dto.purchase.PurchaseCreateDTO;
import com.appTest.store.dto.purchase.PurchaseDTO;
import com.appTest.store.dto.purchase.PurchaseUpdateDTO;
import com.appTest.store.models.Purchase;

import java.util.List;

public interface IPurchaseService {
    List<Purchase> getAllPurchases();
    Purchase getPurchaseById(Long id);
    PurchaseDTO convertPurchaseToDto(Purchase purchase);
    PurchaseDTO createPurchase(PurchaseCreateDTO dto);
    void updatePurchase(PurchaseUpdateDTO dto);
    void deletePurchaseById(Long id);
}
