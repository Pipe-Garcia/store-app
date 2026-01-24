package com.appTest.store.services;

import com.appTest.store.dto.material.MaterialCreateDTO;
import com.appTest.store.dto.material.MaterialDTO;
import com.appTest.store.dto.material.MaterialMostExpensiveDTO;
import com.appTest.store.dto.material.MaterialStockAlertDTO;
import com.appTest.store.dto.material.MaterialUpdateDTO;
import com.appTest.store.models.Family;
import com.appTest.store.models.Material;
import com.appTest.store.models.Stock;
import com.appTest.store.models.Warehouse;
import com.appTest.store.repositories.IFamilyRepository;
import com.appTest.store.repositories.IMaterialRepository;
import com.appTest.store.repositories.IStockRepository;
import com.appTest.store.repositories.IWarehouseRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class MaterialService implements IMaterialService {

    @Autowired private IMaterialRepository repoMat;
    @Autowired private IFamilyRepository repoFam;
    @Autowired private IWarehouseRepository repoWare;
    @Autowired private IStockRepository repoStock;

    @Autowired private AuditService audit;

    /* ==================== Utils ==================== */

    private String norm(String s){ return s==null? null : s.trim(); }
    private boolean hasText(String s){ return s!=null && !s.trim().isEmpty(); }

    // Snapshot “plano” para diffs (sin listas para evitar recursión)
    private Map<String, Object> snap(Material m){
        if (m==null) return null;
        Map<String,Object> map = new LinkedHashMap<>();
        map.put("id",               m.getIdMaterial());
        map.put("nombre",           m.getName());
        map.put("marca",            m.getBrand());
        map.put("precioArs",        m.getPriceArs());
        map.put("precioUsd",        m.getPriceUsd());
        map.put("unidadMedida",     m.getMeasurementUnit());
        map.put("nroInterno",       m.getInternalNumber());
        map.put("descripcion",      m.getDescription());
        map.put("estado",           m.getStatus());
        map.put("familiaId",        m.getFamily()!=null? m.getFamily().getIdFamily() : null);
        map.put("familiaNombre",    m.getFamily()!=null? m.getFamily().getTypeFamily() : null);

        Long depoId   = null;
        String depoNm = null;
        if (m.getStockList() != null && !m.getStockList().isEmpty()) {
            Stock primary = m.getStockList().stream()
                    .filter(Objects::nonNull)
                    .min(Comparator.comparing(Stock::getIdStock))
                    .orElse(null);
            if (primary != null && primary.getWarehouse() != null) {
                depoId = primary.getWarehouse().getIdWarehouse();
                depoNm = primary.getWarehouse().getName();
            }
        }
        map.put("depositoId",    depoId);
        map.put("depositoNombre",depoNm);
        return map;
    }

    private record Change(String field, Object from, Object to) {}

    private List<Change> diff(Map<String,Object> a, Map<String,Object> b){
        List<Change> out = new ArrayList<>();
        Set<String> keys = new LinkedHashSet<>();
        if (a!=null) keys.addAll(a.keySet());
        if (b!=null) keys.addAll(b.keySet());

        for (String k: keys){
            Object va = (a!=null) ? a.get(k) : null;
            Object vb = (b!=null) ? b.get(k) : null;

            // BigDecimal: consideramos igual si compareTo == 0
            if (va instanceof BigDecimal && vb instanceof BigDecimal){
                BigDecimal bdA = (BigDecimal) va;
                BigDecimal bdB = (BigDecimal) vb;
                if (bdA.compareTo(bdB) == 0) {
                    continue;
                }
                out.add(new Change(k, bdA, bdB));
                continue;
            }

            if (!Objects.equals(va, vb)){
                out.add(new Change(k, va, vb));
            }
        }
        return out;
    }

    private String humanField(String k){
        return switch (k){
            case "nombre"        -> "Nombre";
            case "marca"         -> "Marca";
            case "precioArs"     -> "Precio ARS";
            case "precioUsd"     -> "Precio USD";
            case "unidadMedida"  -> "Unidad";
            case "nroInterno"    -> "N° interno";
            case "descripcion"   -> "Descripción";
            case "estado"        -> "Estado";
            case "familiaId", "familiaNombre" -> "Familia";
            case "depositoId", "depositoNombre" -> "Depósito";
            default -> k;
        };
    }

    private String fmt(Object v){
        if (v==null || (v instanceof String s && s.isBlank())) return "—";
        if (v instanceof BigDecimal bd) return bd.stripTrailingZeros().toPlainString();
        return String.valueOf(v);
    }

    private String summarize(List<Change> changes){
        if (changes==null || changes.isEmpty()) return "OK";
        String s = changes.stream()
                .limit(3)
                .map(c -> humanField(c.field()) + ": " + fmt(c.from()) + " → " + fmt(c.to()))
                .collect(Collectors.joining(" · "));
        if (changes.size()>3) s += " +" + (changes.size()-3) + " más";
        return s;
    }

    // Ejecuta “después del commit”
    private void afterCommit(Runnable r){
        if (TransactionSynchronizationManager.isSynchronizationActive()){
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit() { r.run(); }
            });
        } else {
            r.run();
        }
    }

    /* ==================== API pública ==================== */

    @Override
    public List<Material> getAllMaterials(Boolean includeDeleted) {
        if (Boolean.TRUE.equals(includeDeleted)) {
            return repoMat.findAll();
        }
        return repoMat.findByStatus("ACTIVE");
    }

    @Override
    public MaterialDTO convertMaterialToDto(Material material) {
        BigDecimal totalQty = material.getStockList().stream()
                .map(Stock::getQuantityAvailable)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        int totalSales = material.getSaleDetailList().stream()
                .mapToInt(sd -> sd.getQuantity().intValue())
                .sum();

        Long famId   = (material.getFamily()!=null) ? material.getFamily().getIdFamily()   : null;
        String famName = (material.getFamily()!=null) ? material.getFamily().getTypeFamily() : null;

        return new MaterialDTO(
                material.getIdMaterial(),
                material.getName(),
                material.getBrand(),
                material.getPriceArs(),
                material.getPriceUsd(),
                material.getMeasurementUnit(),
                material.getInternalNumber(),
                material.getDescription(),
                material.getStatus(),
                famId, famName, famName,
                totalQty, totalSales,
                material.getStockList().size(),
                material.getMaterialSuppliers().size(),
                material.getSaleDetailList().size(),
                material.getOrderDetails().size()
        );
    }

    @Override
    public Material getMaterialById(Long idMaterial) {
        return repoMat.findById(idMaterial).orElse(null);
    }

    @Override
    public List<MaterialStockAlertDTO> getMaterialsWithLowStock() {
        return repoMat.getMaterialsWithLowStock();
    }

    @Override
    public MaterialMostExpensiveDTO getMaterialByHighestPrice() {
        List<MaterialMostExpensiveDTO> list = repoMat.getMaterialByHighestPrice();
        return list.isEmpty() ? null : list.get(0);
    }

    /* ==================== CREATE ==================== */

    @Override
    @Transactional
    public MaterialDTO createMaterial(MaterialCreateDTO dto) {

        Material material = new Material();
        material.setName(dto.getName());
        material.setBrand(dto.getBrand());
        material.setPriceArs(dto.getPriceArs());
        material.setPriceUsd(dto.getPriceUsd());
        material.setMeasurementUnit(dto.getMeasurementUnit());
        material.setInternalNumber(dto.getInternalNumber());
        material.setDescription(dto.getDescription());
        // Siempre nace activo
        material.setStatus("ACTIVE");

        Family family = repoFam.findById(dto.getFamilyId())
                .orElseThrow(() -> new EntityNotFoundException("Family not found with ID: " + dto.getFamilyId()));
        material.setFamily(family);

        Material savedMaterial = repoMat.save(material);

        Warehouse warehouse = null;
        if (dto.getWarehouse() != null) {
            warehouse = new Warehouse();
            warehouse.setAddress(dto.getWarehouse().getAddress());
            warehouse.setName(dto.getWarehouse().getName());
            warehouse.setLocation(dto.getWarehouse().getLocation());
            warehouse = repoWare.save(warehouse);
        }

        if (dto.getStock() != null) {
            Stock stock = new Stock();
            stock.setMaterial(savedMaterial);
            stock.setWarehouse(warehouse != null ? warehouse : repoWare.findById(dto.getStock().getWarehouseId())
                    .orElseThrow(() -> new EntityNotFoundException("Warehouse not found")));
            stock.setQuantityAvailable(dto.getStock().getQuantityAvailable());
            stock.setLastUpdate(LocalDate.now());
            repoStock.save(stock);
        }

        savedMaterial = repoMat.findById(savedMaterial.getIdMaterial())
                .orElseThrow(() -> new EntityNotFoundException("Material not found after creation"));

        final Long mid   = savedMaterial.getIdMaterial();
        final Map<String,Object> after = snap(savedMaterial);
        final String name = savedMaterial.getName();

        afterCommit(() -> {
            Long evId = audit.success("CREATE", "Material", mid, "Creado material \"" + name + "\"");
            Map<String,Object> diff = Map.of("created", true, "fields", after);
            audit.attachDiff(evId, null, after, diff);
        });

        return convertMaterialToDto(savedMaterial);
    }

    /* ==================== UPDATE ==================== */

    @Override
    @Transactional
    public void updateMaterial(MaterialUpdateDTO dto) {
        Material material = repoMat.findById(dto.getIdMaterial())
                .orElseThrow(() -> new EntityNotFoundException("Material not found with ID: " + dto.getIdMaterial()));

        Map<String,Object> before = snap(material);

        if (hasText(dto.getName())) material.setName(norm(dto.getName()));
        if (hasText(dto.getBrand())) material.setBrand(norm(dto.getBrand()));
        if (dto.getPriceArs() != null) material.setPriceArs(dto.getPriceArs());
        if (dto.getPriceUsd() != null) material.setPriceUsd(dto.getPriceUsd());
        if (hasText(dto.getInternalNumber())) material.setInternalNumber(norm(dto.getInternalNumber()));
        if (hasText(dto.getMeasurementUnit())) material.setMeasurementUnit(norm(dto.getMeasurementUnit()));
        if (dto.getDescription()!=null) material.setDescription(norm(dto.getDescription()));

        if (dto.getFamilyId() != null) {
            Family family = repoFam.findById(dto.getFamilyId())
                    .orElseThrow(() -> new EntityNotFoundException("Family not found with ID: " + dto.getFamilyId()));
            material.setFamily(family);
        }

        if (dto.getWarehouseId() != null) {
            Warehouse newWh = repoWare.findById(dto.getWarehouseId())
                    .orElseThrow(() -> new EntityNotFoundException("Warehouse not found with ID: " + dto.getWarehouseId()));

            List<Stock> stocks = repoStock.findByMaterial_IdMaterial(material.getIdMaterial());

            if (stocks.isEmpty()) {
                Stock st = new Stock();
                st.setMaterial(material);
                st.setWarehouse(newWh);
                st.setQuantityAvailable(BigDecimal.ZERO);
                st.setLastUpdate(LocalDate.now());
                repoStock.save(st);
                material.getStockList().add(st);
            } else if (stocks.size() == 1) {
                Stock st = stocks.get(0);
                if (!Objects.equals(
                        st.getWarehouse().getIdWarehouse(),
                        newWh.getIdWarehouse()
                )) {
                    st.setWarehouse(newWh);
                    st.setLastUpdate(LocalDate.now());
                    repoStock.save(st);
                }
            } else {
                // multi-depósito: se maneja desde la pantalla de stock
            }
        }

        repoMat.save(material);

        Map<String,Object> after = snap(material);
        List<Change> changes = diff(before, after);
        String message = summarize(changes);

        final Long mid = material.getIdMaterial();
        final List<Map<String,Object>> changed = changes.stream()
                .map(c -> Map.of("field", c.field(), "from", c.from(), "to", c.to()))
                .collect(Collectors.toList());
        final Map<String,Object> payload = Map.of("changed", changed);

        afterCommit(() -> {
            Long evId = audit.success("UPDATE", "Material", mid, message);
            audit.attachDiff(evId, before, after, payload);
        });
    }

    /* ==================== DELETE (Soft delete) ==================== */

    @Override
    @Transactional
    public boolean deleteMaterialById(Long idMaterial) {
        Material material = repoMat.findById(idMaterial).orElse(null);
        if (material == null) {
            return false;
        }

        Map<String,Object> before = snap(material);

        material.setStatus("INACTIVE");
        repoMat.save(material);

        Map<String,Object> after = snap(material);
        List<Change> changes = diff(before, after);
        String message = summarize(changes);

        final Long mid = material.getIdMaterial();
        final List<Map<String,Object>> changed = changes.stream()
                .map(c -> Map.of("field", c.field(), "from", c.from(), "to", c.to()))
                .collect(Collectors.toList());
        final Map<String,Object> payload = Map.of("changed", changed);

        afterCommit(() -> {
            Long evId = audit.success("SOFT_DELETE", "Material", mid, message);
            audit.attachDiff(evId, before, after, payload);
        });

        return true;
    }

    /* ==================== RESTORE ==================== */

    @Override
    @Transactional
    public void restoreMaterial(Long idMaterial) {
        Material material = repoMat.findById(idMaterial).orElse(null);
        if (material == null) {
            return;
        }

        Map<String,Object> before = snap(material);

        material.setStatus("ACTIVE");
        repoMat.save(material);

        Map<String,Object> after = snap(material);
        List<Change> changes = diff(before, after);
        String message = summarize(changes);

        final Long mid = material.getIdMaterial();
        final List<Map<String,Object>> changed = changes.stream()
                .map(c -> Map.of("field", c.field(), "from", c.from(), "to", c.to()))
                .collect(Collectors.toList());
        final Map<String,Object> payload = Map.of("changed", changed);

        afterCommit(() -> {
            Long evId = audit.success("RESTORE", "Material", mid, message);
            audit.attachDiff(evId, before, after, payload);
        });
    }
}
