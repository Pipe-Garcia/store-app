package com.appTest.store.services;

import com.appTest.store.audit.Auditable;
import com.appTest.store.dto.purchase.PurchaseCreateDTO;
import com.appTest.store.dto.purchase.PurchaseDTO;
import com.appTest.store.dto.purchase.PurchaseUpdateDTO;
import com.appTest.store.dto.purchaseDetail.PurchaseDetailRequestDTO;
import com.appTest.store.models.*;
import com.appTest.store.models.enums.DocumentStatus;
import com.appTest.store.repositories.IMaterialRepository;
import com.appTest.store.repositories.IMaterialSupplierRepository;
import com.appTest.store.repositories.IPurchaseRepository;
import com.appTest.store.repositories.ISupplierRepository;
import com.appTest.store.repositories.IWarehouseRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class PurchaseService implements IPurchaseService {

    @Autowired private IPurchaseRepository repoPurch;
    @Autowired private IMaterialSupplierRepository repoMatSup;
    @Autowired private IMaterialRepository repoMat;

    @Autowired private IWarehouseRepository repoWare;

    @Autowired private IStockService servStock;
    @Autowired private ISupplierRepository repoSup;

    @Autowired private AuditService audit;

    /* ========= Helpers auditoría (similar a MaterialService) ========= */

    private Map<String,Object> snap(Purchase p){
        if (p == null) return null;
        Map<String,Object> map = new LinkedHashMap<>();
        map.put("id",          p.getIdPurchase());
        map.put("fecha",       p.getDatePurchase());
        map.put("proveedorId", p.getSupplier()!=null ? p.getSupplier().getIdSupplier()   : null);
        map.put("proveedor",   p.getSupplier()!=null ? p.getSupplier().getNameCompany() : null);
        map.put("total",       calculateTotal(p));
        map.put("status",      p.getStatus()!=null ? p.getStatus().name() : null);
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
            case "status"       -> "Estado";
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

    private void afterCommit(Runnable r){
        if (TransactionSynchronizationManager.isSynchronizationActive()){
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override public void afterCommit() { r.run(); }
                    }
            );
        } else {
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
        Long supplierId = null;
        String supplierName = "Proveedor no encontrado";

        if (purchase.getSupplier() != null) {
            supplierId = purchase.getSupplier().getIdSupplier();

            if (purchase.getSupplier().getNameCompany() != null &&
                    !purchase.getSupplier().getNameCompany().isBlank()) {

                supplierName = purchase.getSupplier().getNameCompany();
            } else {
                String name = purchase.getSupplier().getName()    != null ? purchase.getSupplier().getName()    : "";
                String sur  = purchase.getSupplier().getSurname() != null ? purchase.getSupplier().getSurname() : "";
                String full = (name + " " + sur).trim();
                if (!full.isBlank()) supplierName = full;
            }
        }

        BigDecimal totalAmount = calculateTotal(purchase);
        String status = (purchase.getStatus() != null) ? purchase.getStatus().name() : DocumentStatus.ACTIVE.name();

        return new PurchaseDTO(
                purchase.getIdPurchase(),
                purchase.getDatePurchase(),
                supplierId,
                supplierName,
                totalAmount,
                status
        );
    }

    private BigDecimal calculateTotal(Purchase purchase) {
        if (purchase.getPurchaseDetails() == null) return BigDecimal.ZERO;
        return purchase.getPurchaseDetails().stream()
                .map(d -> d.getQuantity().multiply(d.getPurchasedPrice()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    @Override
    @Transactional
    public PurchaseDTO createPurchase(PurchaseCreateDTO dto) {
        Purchase purchase = new Purchase();
        purchase.setDatePurchase(dto.getDatePurchase());
        purchase.setStatus(DocumentStatus.ACTIVE);

        Supplier supplier = repoSup.findById(dto.getSupplierId())
                .orElseThrow(() -> new EntityNotFoundException("Supplier not found with ID: " + dto.getSupplierId()));
        purchase.setSupplier(supplier);

        List<PurchaseDetail> purchaseDetailList = new ArrayList<>();

        for (PurchaseDetailRequestDTO item : dto.getMaterials()) {
            MaterialSupplier materialSupplier = repoMatSup.findById(item.getMaterialSupplierId())
                    .orElseThrow(() -> new EntityNotFoundException("MaterialSupplier not found with ID: " + item.getMaterialSupplierId()));

            if (!materialSupplier.getSupplier().getIdSupplier().equals(supplier.getIdSupplier())) {
                throw new IllegalArgumentException("All materials must belong to the specified supplier.");
            }

            Warehouse warehouse = repoWare.findById(item.getWarehouseId())
                    .orElseThrow(() -> new EntityNotFoundException("Warehouse not found with ID: " + item.getWarehouseId()));

            PurchaseDetail purchaseDetail = new PurchaseDetail();
            purchaseDetail.setMaterialSupplier(materialSupplier);
            purchaseDetail.setPurchase(purchase);
            purchaseDetail.setWarehouse(warehouse);
            purchaseDetail.setQuantity(item.getQuantity());
            purchaseDetail.setPurchasedPrice(materialSupplier.getPriceUnit());
            purchaseDetailList.add(purchaseDetail);

            Long materialId = materialSupplier.getMaterial().getIdMaterial();
            servStock.increaseStock(materialId, item.getWarehouseId(), item.getQuantity());
        }

        purchase.setPurchaseDetails(purchaseDetailList);

        Purchase savedPurchase = repoPurch.save(purchase);
        savedPurchase = repoPurch.findById(savedPurchase.getIdPurchase())
                .orElseThrow(() -> new EntityNotFoundException("Purchase not found after creation"));

        final Long pid = savedPurchase.getIdPurchase();
        final Map<String,Object> after = snap(savedPurchase);
        final String proveedor = savedPurchase.getSupplier() != null
                ? savedPurchase.getSupplier().getNameCompany()
                : "—";
        final BigDecimal total = calculateTotal(savedPurchase);
        final String message = "Proveedor: " + proveedor + " · Total: " + fmt(total);

        afterCommit(() -> {
            Long evId = audit.success("CREATE", "Purchase", pid, message);
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

        if (purchase.getStatus() == DocumentStatus.CANCELLED){
            throw new IllegalStateException("No se puede editar una compra ANULADA.");
        }

        Map<String,Object> before = snap(purchase);

        if (dto.getDatePurchase() != null) purchase.setDatePurchase(dto.getDatePurchase());
        if (dto.getSupplierId() != null) {
            Supplier supplier = repoSup.findById(dto.getSupplierId())
                    .orElseThrow(() -> new EntityNotFoundException("Supplier not found with ID: " + dto.getSupplierId()));
            purchase.setSupplier(supplier);
        }
        repoPurch.save(purchase);

        Map<String,Object> after = snap(purchase);
        List<Change> changes = diff(before, after);
        String message = summarize(changes);

        final Long pid = purchase.getIdPurchase();

        afterCommit(() -> {
            Long evId = audit.success("UPDATE", "Purchase", pid, message);
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
    public PurchaseDTO cancelPurchase(Long id) {
        Purchase p = repoPurch.findFullById(id)
                .orElseThrow(() -> new EntityNotFoundException("Purchase not found with ID: " + id));

        if (p.getStatus() == DocumentStatus.CANCELLED){
            return convertPurchaseToDto(p);
        }

        if (p.getPurchaseDetails() == null || p.getPurchaseDetails().isEmpty()){
            throw new IllegalStateException("No se puede anular: la compra no tiene detalles.");
        }

        // 1) Validar que exista warehouse por detalle y que haya stock suficiente para revertir
        for (PurchaseDetail d : p.getPurchaseDetails()){
            if (d.getWarehouse() == null){
                throw new IllegalStateException(
                        "No se puede anular esta compra: hay detalles sin depósito (warehouse_id NULL). " +
                                "Probablemente es una compra vieja (legacy)."
                );
            }
            if (d.getMaterialSupplier() == null || d.getMaterialSupplier().getMaterial() == null){
                throw new IllegalStateException("No se puede anular: detalle sin material asociado.");
            }

            Long materialId = d.getMaterialSupplier().getMaterial().getIdMaterial();
            Long warehouseId = d.getWarehouse().getIdWarehouse();
            BigDecimal qty = d.getQuantity() != null ? d.getQuantity() : BigDecimal.ZERO;

            BigDecimal available = servStock.availability(materialId, warehouseId);
            if (available.compareTo(qty) < 0){
                String matName = d.getMaterialSupplier().getMaterial().getName();
                String whName  = d.getWarehouse().getName();
                throw new IllegalStateException(
                        "No se puede anular: stock insuficiente para revertir. " +
                                "Material: " + matName + " · Depósito: " + whName +
                                " · Disponible: " + available.stripTrailingZeros().toPlainString() +
                                " · A revertir: " + qty.stripTrailingZeros().toPlainString()
                );
            }
        }

        // 2) Revertir stock (restar lo que esta compra había ingresado)
        for (PurchaseDetail d : p.getPurchaseDetails()){
            Long materialId = d.getMaterialSupplier().getMaterial().getIdMaterial();
            Long warehouseId = d.getWarehouse().getIdWarehouse();
            BigDecimal qty = d.getQuantity();
            servStock.decreaseStock(materialId, warehouseId, qty);
        }

        // 3) Marcar CANCELLED
        Map<String,Object> before = snap(p);

        p.setStatus(DocumentStatus.CANCELLED);
        repoPurch.save(p);

        Map<String,Object> after = snap(p);

        final Long pid = p.getIdPurchase();
        final String proveedor = p.getSupplier() != null
                ? p.getSupplier().getNameCompany()
                : "—";
        final BigDecimal total = calculateTotal(p);
        final String message = "Compra anulada · Proveedor: " + proveedor + " · Total: " + fmt(total);

        afterCommit(() -> {
            Long evId = audit.success("CANCEL", "Purchase", pid, message);
            Map<String,Object> diffPayload = Map.of(
                    "changed", List.of(Map.of("field","status","from","ACTIVE","to","CANCELLED"))
            );
            audit.attachDiff(evId, before, after, diffPayload);
        });

        return convertPurchaseToDto(p);
    }

    @Override
    @Transactional
    @Auditable(entity="Purchase", action="DELETE", idParam="id")
    public void deletePurchaseById(Long id) {
        repoPurch.deleteById(id);
    }
}