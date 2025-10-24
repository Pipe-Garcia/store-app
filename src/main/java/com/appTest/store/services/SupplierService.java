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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class SupplierService implements ISupplierService {

    @Autowired
    private ISupplierRepository repoSupplier;

    @Autowired
    private IMaterialSupplierRepository matSupRepo;

    @Autowired
    private IMaterialRepository materialRepo;

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

        // Agregar materiales asociados
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
    @Auditable(action="SUPPLIER_CREATE", entity="Supplier")
    public SupplierDTO createSupplier(SupplierCreateDTO dto) {
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

        return convertSupplierToDto(saved);
    }

    @Override
    @Transactional
    @Auditable(entity="Supplier", action="UPDATE", idParam="dto.idSupplier")
    public SupplierDTO updateSupplier(Long id, SupplierCreateDTO dto) {
        Supplier supplier = getSupplierById(id);

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

        matSupRepo.deleteBySupplier(supplier);

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
