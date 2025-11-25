package com.appTest.store.services;

import com.appTest.store.audit.Auditable;
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
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.*;
import java.util.stream.Collectors;


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

    @Autowired
    private AuditService audit;

    /* ========= Helpers auditoría (similar a MaterialService) ========= */

    private Map<String,Object> snap(Purchase p){
        if (p == null) return null;
        Map<String,Object> map = new LinkedHashMap<>();
        map.put("id",          p.getIdPurchase());
        map.put("fecha",       p.getDatePurchase());
        map.put("proveedorId", p.getSupplier()!=null ? p.getSupplier().getIdSupplier()   : null);
        map.put("proveedor",   p.getSupplier()!=null ? p.getSupplier().getNameCompany() : null);
        map.put("total",       calculateTotal(p));
        return map;
    }

    private record Change(String field, Object from, Object to) {}

    private List<Change> diff(Map<String,Object> a, Map<String,Object> b){
        List<Change> out = new ArrayList<>();
        Set<String> keys = new LinkedHashSet<>();
        if (a != null) keys.addAll(a.keySet());
        if (b != null) keys.addAll(b.keySet());
        for (String k : keys){
            Object va = (a != null) ? a.get(k) : null;
            Object vb = (b != null) ? b.get(k) : null;
            if (!Objects.equals(va, vb)){
                out.add(new Change(k, va, vb));
            }
        }
        return out;
    }

    private String humanField(String k){
        return switch (k){
            case "fecha"        -> "Fecha";
            case "proveedor", "proveedorId" -> "Proveedor";
            case "total"        -> "Total";
            default -> k;
        };
    }

    private String fmt(Object v){
        if (v == null || (v instanceof String s && s.isBlank())) return "—";
        if (v instanceof BigDecimal bd) return bd.stripTrailingZeros().toPlainString();
        return String.valueOf(v);
    }

    private String summarize(List<Change> changes){
        if (changes == null || changes.isEmpty()) return "OK";
        return changes.stream()
                .limit(3)
                .map(c -> humanField(c.field()) + ": " + fmt(c.from()) + " → " + fmt(c.to()))
                .collect(Collectors.joining(" · "))
                + (changes.size()>3 ? " +" + (changes.size()-3) + " más" : "");
    }

    // Ejecutar algo después del commit de la transacción actual
    private void afterCommit(Runnable r){
        if (TransactionSynchronizationManager.isSynchronizationActive()){
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override public void afterCommit() { r.run(); }
                    }
            );
        } else {
            // fallback: sin TX activa
            r.run();
        }
    }

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

        // === AUDITORÍA: CREATE con mensaje humano ===
        final Long pid = savedPurchase.getIdPurchase();
        final Map<String,Object> after = snap(savedPurchase);
        final String proveedor = savedPurchase.getSupplier() != null
                ? savedPurchase.getSupplier().getNameCompany()
                : "—";
        final BigDecimal total = calculateTotal(savedPurchase);
        final String message = "Proveedor: " + proveedor + " · Total: " + fmt(total);

        afterCommit(() -> {
            Long evId = audit.success("CREATE", "Purchase", pid, message);
            // payload “tipo create” para diffJson
            Map<String,Object> diffPayload = Map.of(
                    "created", true,
                    "fields",  after
            );
            audit.attachDiff(evId, null, after, diffPayload);
        });

        return convertPurchaseToDto(savedPurchase);
    }



    @Override
    @Transactional
    public void updatePurchase(PurchaseUpdateDTO dto) {
        Purchase purchase = repoPurch.findById(dto.getIdPurchase())
                .orElseThrow(() -> new EntityNotFoundException("Purchase not found with ID: " + dto.getIdPurchase()));

        // Snapshot “antes”
        Map<String,Object> before = snap(purchase);

        if (dto.getDatePurchase() != null) purchase.setDatePurchase(dto.getDatePurchase());
        if (dto.getSupplierId() != null) {
            Supplier supplier = repoSup.findById(dto.getSupplierId())
                    .orElseThrow(() -> new EntityNotFoundException("Supplier not found with ID: " + dto.getSupplierId()));
            purchase.setSupplier(supplier);
        }
        repoPurch.save(purchase);

        // Snapshot “después”
        Map<String,Object> after = snap(purchase);
        List<Change> changes = diff(before, after);
        String message = summarize(changes);

        final Long pid = purchase.getIdPurchase();

        afterCommit(() -> {
            Long evId = audit.success("UPDATE", "Purchase", pid, message);
            // estructura de diff amigable
            var changed = changes.stream()
                    .map(c -> Map.<String,Object>of(
                            "field", c.field(),
                            "from",  c.from(),
                            "to",    c.to()
                    ))
                    .collect(Collectors.toList());
            Map<String,Object> diffPayload = Map.of("changed", changed);
            audit.attachDiff(evId, before, after, diffPayload);
        });
    }


    @Override
    @Transactional
    @Auditable(entity="Purchase", action="DELETE", idParam="id")
    public void deletePurchaseById(Long id) {
        repoPurch.deleteById(id);
    }

}
