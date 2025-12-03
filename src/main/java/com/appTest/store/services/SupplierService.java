package com.appTest.store.services;

import com.appTest.store.audit.Auditable;
import com.appTest.store.dto.materialSupplier.MaterialSupplierCreateDTO;
import com.appTest.store.dto.materialSupplier.MaterialSupplierDTO;
import com.appTest.store.dto.supplier.SupplierCreateDTO;
import com.appTest.store.dto.supplier.SupplierDTO;
import com.appTest.store.models.Material;
import com.appTest.store.models.MaterialSupplier;
import com.appTest.store.models.Supplier;
import com.appTest.store.repositories.IMaterialRepository;
import com.appTest.store.repositories.IMaterialSupplierRepository;
import com.appTest.store.repositories.ISupplierRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class SupplierService implements ISupplierService {

    @Autowired private ISupplierRepository repoSupplier;
    @Autowired private IMaterialSupplierRepository matSupRepo;
    @Autowired private IMaterialRepository materialRepo;

    // Auditoría
    @Autowired private AuditService audit;

    /* ==================== Utils auditoría ==================== */

    private Map<String, Object> snap(Supplier s, int materialsCount){
        if (s == null) return null;
        Map<String,Object> m = new LinkedHashMap<>();
        m.put("id",             s.getIdSupplier());
        m.put("nombre",         s.getName());
        m.put("apellido",       s.getSurname());
        m.put("dni",            s.getDni());
        m.put("email",          s.getEmail());
        m.put("direccion",      s.getAddress());
        m.put("localidad",      s.getLocality());
        m.put("empresa",        s.getNameCompany());
        m.put("telefono",       s.getPhoneNumber());
        m.put("estado",         s.getStatus());
        m.put("materiales",     materialsCount);
        return m;
    }

    private record Change(String field, Object from, Object to) {}
    private List<Change> diff(Map<String,Object> a, Map<String,Object> b){
        List<Change> out = new ArrayList<>();
        Set<String> keys = new LinkedHashSet<>();
        if (a!=null) keys.addAll(a.keySet());
        if (b!=null) keys.addAll(b.keySet());
        for (String k: keys){
            Object va = a!=null? a.get(k) : null;
            Object vb = b!=null? b.get(k) : null;
            if (!Objects.equals(va, vb)) out.add(new Change(k, va, vb));
        }
        return out;
    }
    private String humanField(String k){
        return switch (k){
            case "nombre" -> "Nombre";
            case "apellido" -> "Apellido";
            case "dni" -> "DNI";
            case "email" -> "Email";
            case "direccion" -> "Dirección";
            case "localidad" -> "Localidad";
            case "empresa" -> "Empresa";
            case "telefono" -> "Teléfono";
            case "estado" -> "Estado";
            case "materiales" -> "Materiales asociados";
            default -> k;
        };
    }
    private String fmt(Object v){ return (v==null || String.valueOf(v).isBlank()) ? "—" : String.valueOf(v); }
    private String summarize(List<Change> changes){
        if (changes==null || changes.isEmpty()) return "OK";
        String s = changes.stream()
                .limit(3)
                .map(c -> humanField(c.field()) + ": " + fmt(c.from()) + " → " + fmt(c.to()))
                .collect(Collectors.joining(" · "));
        if (changes.size()>3) s += " +" + (changes.size()-3) + " más";
        return s;
    }
    private void afterCommit(Runnable r){
        if (TransactionSynchronizationManager.isSynchronizationActive()){
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override public void afterCommit(){ r.run(); }
            });
        } else r.run();
    }

    /* ==================== Reglas de unicidad ==================== */

    private void validateUniqueSupplier(String dni, String email, Long currentId){
        String normalizedDni = (dni != null) ? dni.trim() : null;
        String normalizedEmail = (email != null) ? email.trim() : null;

        if (normalizedDni != null && !normalizedDni.isBlank()){
            repoSupplier.findByDni(normalizedDni).ifPresent(existing -> {
                if (currentId == null || !Objects.equals(existing.getIdSupplier(), currentId)) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "A supplier with DNI " + normalizedDni + " already exists"
                    );
                }
            });
        }

        if (normalizedEmail != null && !normalizedEmail.isBlank()){
            repoSupplier.findByEmail(normalizedEmail).ifPresent(existing -> {
                if (currentId == null || !Objects.equals(existing.getIdSupplier(), currentId)) {
                    throw new ResponseStatusException(
                            HttpStatus.BAD_REQUEST,
                            "A supplier with email " + normalizedEmail + " already exists"
                    );
                }
            });
        }
    }

    /* ==================== API existente ==================== */

    @Override
    public List<SupplierDTO> getAllSuppliers() {
        return repoSupplier.findAll()
                .stream()
                .map(this::convertSupplierToDto)
                .collect(Collectors.toList());
    }

    @Override
    public Supplier getSupplierById(Long id) {
        return repoSupplier.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Supplier not found with ID: " + id));
    }

    @Override
    public SupplierDTO getSupplierDtoById(Long id) {
        Supplier supplier = getSupplierById(id);
        SupplierDTO dto = convertSupplierToDto(supplier);

        List<MaterialSupplier> asociados = matSupRepo.findBySupplier(supplier);
        List<MaterialSupplierDTO> materiales = new ArrayList<>();
        for (MaterialSupplier ms : asociados) {
            MaterialSupplierDTO matDTO = new MaterialSupplierDTO();
            matDTO.setIdMaterialSupplier(ms.getIdMaterialSupplier());
            matDTO.setMaterialId(ms.getMaterial().getIdMaterial());
            matDTO.setMaterialName(ms.getMaterial().getName());
            matDTO.setPriceUnit(ms.getPriceUnit());
            matDTO.setDeliveryTimeDays(ms.getDeliveryTimeDays());
            materiales.add(matDTO);
        }
        dto.setMaterials(materiales);
        return dto;
    }

    @Override
    @Transactional
    public SupplierDTO createSupplier(SupplierCreateDTO dto) {

        validateUniqueSupplier(dto.getDni(), dto.getEmail(), null);

        Supplier supplier = new Supplier(
                dto.getName(), dto.getSurname(), dto.getDni(), dto.getEmail(),
                dto.getAddress(), dto.getLocality(), dto.getNameCompany(),
                dto.getPhoneNumber(), dto.getStatus()
        );
        Supplier saved = repoSupplier.save(supplier);

        if (dto.getMaterials() != null) {
            for (MaterialSupplierCreateDTO matDTO : dto.getMaterials()) {
                Material material = materialRepo.findById(matDTO.getMaterialId())
                        .orElseThrow(() -> new EntityNotFoundException("Material not found with ID: " + matDTO.getMaterialId()));
                MaterialSupplier matSup = new MaterialSupplier(
                        matDTO.getDeliveryTimeDays(),
                        material,
                        matDTO.getPriceUnit(),
                        saved
                );
                matSupRepo.save(matSup);
            }
        }

        int afterCount = matSupRepo.findBySupplier(saved).size();
        final Long sid = saved.getIdSupplier();
        final String display = (saved.getNameCompany()!=null && !saved.getNameCompany().isBlank())
                ? saved.getNameCompany()
                : (saved.getName()+" "+saved.getSurname()).trim();
        final Map<String,Object> after = snap(saved, afterCount);

        afterCommit(() -> {
            Long ev = audit.success("SUPPLIER_CREATE", "Supplier", sid,
                    "Creado proveedor \"" + display + "\"");
            Map<String,Object> diff = Map.of("created", true, "fields", after);
            audit.attachDiff(ev, null, after, diff);
        });

        return convertSupplierToDto(saved);
    }


    @Override
    @Transactional
    public SupplierDTO updateSupplier(Long id, SupplierCreateDTO dto) {
        Supplier supplier = getSupplierById(id);

        String newDni = dto.getDni();
        String newEmail = dto.getEmail();
        validateUniqueSupplier(newDni, newEmail, supplier.getIdSupplier());

        int prevCount = matSupRepo.findBySupplier(supplier).size();
        Map<String,Object> before = snap(supplier, prevCount);

        supplier.setName(dto.getName());
        supplier.setSurname(dto.getSurname());
        supplier.setDni(dto.getDni());
        supplier.setEmail(dto.getEmail());
        supplier.setAddress(dto.getAddress());
        supplier.setLocality(dto.getLocality());
        supplier.setNameCompany(dto.getNameCompany());
        supplier.setPhoneNumber(dto.getPhoneNumber());
        supplier.setStatus(dto.getStatus());

        Supplier saved = repoSupplier.save(supplier);

        matSupRepo.deleteBySupplier(saved);
        if (dto.getMaterials() != null) {
            for (MaterialSupplierCreateDTO matDTO : dto.getMaterials()) {
                Material material = materialRepo.findById(matDTO.getMaterialId())
                        .orElseThrow(() -> new EntityNotFoundException("Material not found with ID: " + matDTO.getMaterialId()));
                MaterialSupplier ms = new MaterialSupplier(
                        matDTO.getDeliveryTimeDays(),
                        material,
                        matDTO.getPriceUnit(),
                        saved
                );
                matSupRepo.save(ms);
            }
        }

        int afterCount = matSupRepo.findBySupplier(saved).size();
        Map<String,Object> after = snap(saved, afterCount);
        List<Change> changes = diff(before, after);
        String message = summarize(changes);

        final Long sid = saved.getIdSupplier();
        final List<Map<String,Object>> changed = changes.stream()
                .map(c -> Map.of("field", c.field(), "from", c.from(), "to", c.to()))
                .collect(Collectors.toList());
        final Map<String,Object> payload = Map.of("changed", changed);

        afterCommit(() -> {
            Long ev = audit.success("UPDATE", "Supplier", sid, message);
            audit.attachDiff(ev, before, after, payload);
        });

        return convertSupplierToDto(saved);
    }


    @Override
    @Transactional
    @Auditable(entity="Supplier", action="DELETE", idParam="id")
    public void deleteSupplierById(Long id) {
        Supplier supplier = getSupplierById(id);
        matSupRepo.deleteBySupplier(supplier);
        repoSupplier.deleteById(id);
    }

    @Override
    public SupplierDTO convertSupplierToDto(Supplier s) {
        SupplierDTO dto = new SupplierDTO();
        dto.setIdSupplier(s.getIdSupplier());
        dto.setName(s.getName());
        dto.setSurname(s.getSurname());
        dto.setDni(s.getDni());
        dto.setEmail(s.getEmail());
        dto.setAddress(s.getAddress());
        dto.setLocality(s.getLocality());
        dto.setNameCompany(s.getNameCompany());
        dto.setStatus(s.getStatus());
        dto.setPhoneNumber(s.getPhoneNumber());
        dto.setQuantPurchases(s.getPurchases() != null ? s.getPurchases().size() : 0);
        return dto;
    }
}