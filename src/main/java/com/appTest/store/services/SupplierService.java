package com.appTest.store.services;

import com.appTest.store.dto.supplier.SupplierCreateDTO;
import com.appTest.store.dto.supplier.SupplierDTO;
import com.appTest.store.dto.supplier.SupplierUpdateDTO;
import com.appTest.store.models.Supplier;
import com.appTest.store.repositories.ISupplierRepository;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class SupplierService implements ISupplierService{

    @Autowired
    private ISupplierRepository repoSupplier;

    @Override
    public List<Supplier> getAllSuppliers() {
        return repoSupplier.findAll();
    }

    @Override
    public Supplier getSupplierById(Long id) {
        return repoSupplier.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Supplier not found with ID: " + id));
    }

    @Override
    public SupplierDTO convertSupplierToDto(Supplier supplier) {
        int quantPurchases = (supplier.getPurchases() != null) ? supplier.getPurchases().size() : 0;
        return new SupplierDTO(
                supplier.getIdSupplier(),
                supplier.getName(),
                supplier.getSurname(),
                supplier.getDni(),
                supplier.getEmail(),
                supplier.getAddress(),
                supplier.getLocality(),
                supplier.getNameCompany(),
                supplier.getStatus(),
                supplier.getPhoneNumber(),
                quantPurchases
        );
    }

    @Override
    @Transactional
    public SupplierDTO createSupplier(SupplierCreateDTO dto) {
        Supplier supplier = new Supplier();
        supplier.setName(dto.getName());
        supplier.setSurname(dto.getSurname());
        supplier.setDni(dto.getDni());
        supplier.setEmail(dto.getEmail());
        supplier.setAddress(dto.getAddress());
        supplier.setLocality(dto.getLocality());
        supplier.setNameCompany(dto.getNameCompany());
        supplier.setPhoneNumber(dto.getPhoneNumber());
        supplier.setStatus(dto.getStatus());

        Supplier savedSupplier = repoSupplier.save(supplier);
        savedSupplier = repoSupplier.findById(savedSupplier.getIdSupplier())
                .orElseThrow(() -> new EntityNotFoundException("Supplier not found after creation"));
        return convertSupplierToDto(savedSupplier);
    }

    @Override
    @Transactional
    public void updateSupplier(SupplierUpdateDTO dto) {
        Supplier supplier = repoSupplier.findById(dto.getIdSupplier())
                .orElseThrow(() -> new EntityNotFoundException("Supplier not found with ID: " + dto.getIdSupplier()));

        if (supplier != null) {
            if (dto.getName() != null) supplier.setName(dto.getName());
            if (dto.getSurname() != null) supplier.setSurname(dto.getSurname());
            if (dto.getDni() != null) supplier.setDni(dto.getDni());
            if (dto.getEmail() != null) supplier.setEmail(dto.getEmail());
            if (dto.getAddress() != null) supplier.setAddress(dto.getAddress());
            if (dto.getLocality() != null) supplier.setLocality(dto.getLocality());
            if (dto.getNameCompany() != null) supplier.setNameCompany(dto.getNameCompany());
            if (dto.getPhoneNumber() != null) supplier.setPhoneNumber(dto.getPhoneNumber());
            if (dto.getStatus() != null) supplier.setStatus(dto.getStatus());
        }
    }

    @Override
    @Transactional
    public void deleteSupplierById(Long id) {
        repoSupplier.deleteById(id);
    }
}
