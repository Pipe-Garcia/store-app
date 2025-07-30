package com.appTest.store.services;

import com.appTest.store.dto.purchase.PurchaseCreateDTO;
import com.appTest.store.dto.purchase.PurchaseDTO;
import com.appTest.store.dto.purchase.PurchaseUpdateDTO;
import com.appTest.store.dto.purchaseDetail.PurchaseDetailRequestDTO;
import com.appTest.store.models.*;
import com.appTest.store.repositories.IMaterialRepository;
import com.appTest.store.repositories.IMaterialSupplierRepository;
import com.appTest.store.repositories.IPurchaseRepository;
import com.appTest.store.repositories.ISupplierRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Service
public class PurchaseService implements IPurchaseService{

    @Autowired
    private IPurchaseRepository repoPurch;

    @Autowired
    private IMaterialSupplierRepository repoMatSup;

    @Autowired
    private IMaterialRepository repoMat;

    @Autowired
    private IStockService servStock;

    @Autowired
    private ISupplierRepository repoSup;

    @Override
    public List<Purchase> getAllPurchases() {
        return repoPurch.findAll();
    }

    @Override
    public Purchase getPurchaseById(Long id) {
        return repoPurch.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Purchase not found with ID: " + id));
    }

    @Override
    public PurchaseDTO convertPurchaseToDto(Purchase purchase) {
        String supplierName = (purchase.getSupplier() != null) ? purchase.getSupplier().getNameCompany() : "Supplier's name not found";
        BigDecimal totalAmount = calculateTotal(purchase);
        return new PurchaseDTO(
                purchase.getIdPurchase(),
                purchase.getDatePurchase(),
                supplierName,
                totalAmount
        );
    }

    private BigDecimal calculateTotal(Purchase purchase) {
        return purchase.getPurchaseDetails().stream()
                .map(purchaseDetail -> purchaseDetail.getQuantity().multiply(purchaseDetail.getPurchasedPrice()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Override
    @Transactional
    public PurchaseDTO createPurchase(PurchaseCreateDTO dto) {
        Purchase purchase = new Purchase();
        purchase.setDatePurchase(dto.getDatePurchase());


        Supplier supplier = repoSup.findById(dto.getSupplierId())
                .orElseThrow(() -> new EntityNotFoundException("Supplier not found with ID: " + dto.getSupplierId()));
        purchase.setSupplier(supplier);

        List<PurchaseDetail> purchaseDetailList = new ArrayList<>();

        for (PurchaseDetailRequestDTO item : dto.getMaterials()) {
            MaterialSupplier materialSupplier = repoMatSup.findById(item.getMaterialSupplierId())
                    .orElseThrow(() -> new EntityNotFoundException("MaterialSupplier not found with ID: " + item.getMaterialSupplierId()));

            // 🔒 Validar que todos los materiales pertenezcan al mismo proveedor
            if (!materialSupplier.getSupplier().getIdSupplier().equals(supplier.getIdSupplier())) {
                throw new IllegalArgumentException("All materials must belong to the specified supplier.");
            }

            // Crear PurchaseDetail
            PurchaseDetail purchaseDetail = new PurchaseDetail();
            purchaseDetail.setMaterialSupplier(materialSupplier);
            purchaseDetail.setPurchase(purchase);
            purchaseDetail.setQuantity(item.getQuantity());
            purchaseDetail.setPurchasedPrice(materialSupplier.getPriceUnit());
            purchaseDetailList.add(purchaseDetail);

            // Derivar materialId desde materialSupplier
            Long materialId = materialSupplier.getMaterial().getIdMaterial();

            // Actualizar stock
            servStock.increaseStock(materialId, item.getWarehouseId(), item.getQuantity());
        }

        purchase.setPurchaseDetails(purchaseDetailList);

        Purchase savedPurchase = repoPurch.save(purchase);
        savedPurchase = repoPurch.findById(savedPurchase.getIdPurchase())
                .orElseThrow(() -> new EntityNotFoundException("Purchase not found after creation"));

        return convertPurchaseToDto(savedPurchase);
    }


    @Override
    @Transactional
    public void updatePurchase(PurchaseUpdateDTO dto) {
        Purchase purchase = repoPurch.findById(dto.getIdPurchase())
                .orElseThrow(() -> new EntityNotFoundException("Purchase not found with ID: " + dto.getIdPurchase()));

        if (dto.getDatePurchase() != null) purchase.setDatePurchase(dto.getDatePurchase());
        if (dto.getSupplierId() != null) {
            Supplier supplier = repoSup.findById(dto.getSupplierId())
                    .orElseThrow(() -> new EntityNotFoundException("Supplier not found with ID: " + dto.getSupplierId()));
            purchase.setSupplier(supplier);
        }
        repoPurch.save(purchase);
    }

    @Override
    @Transactional
    public void deletePurchaseById(Long id) {
        repoPurch.deleteById(id);
    }
}
