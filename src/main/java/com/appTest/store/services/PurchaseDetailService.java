package com.appTest.store.services;

import com.appTest.store.dto.purchaseDetail.PurchaseDetailDTO;
import com.appTest.store.models.PurchaseDetail;
import com.appTest.store.repositories.IPurchaseDetailRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PurchaseDetailService implements IPurchaseDetailService {

    @Autowired
    private IPurchaseDetailRepository repoPurchaseDetail;

    @Override
    public List<PurchaseDetail> getAllPurchaseDetail() {
        return repoPurchaseDetail.findAll();
    }

    @Override
    public PurchaseDetail getPurchaseDetailById(Long id) {
        return repoPurchaseDetail.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Purchase Detail not found with ID: " + id));
    }

    @Override
    public PurchaseDetailDTO convertPurchaseDetailToDto(PurchaseDetail purchaseDetail) {
        String materialName = (purchaseDetail.getMaterialSupplier() != null) ? purchaseDetail.getMaterialSupplier().getMaterial().getName() : "Material not found";
        return new PurchaseDetailDTO(
                purchaseDetail.getIdPurchaseDetail(),
                purchaseDetail.getPurchase().getIdPurchase(),
                materialName,
                purchaseDetail.getQuantity(),
                purchaseDetail.getPurchasedPrice()
        );
    }

    @Override
    @Transactional
    public void deletePurchaseDetailById(Long id) {
        repoPurchaseDetail.deleteById(id);
    }
}
