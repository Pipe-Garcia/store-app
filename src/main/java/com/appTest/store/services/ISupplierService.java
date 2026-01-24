package com.appTest.store.services;

import com.appTest.store.dto.supplier.SupplierCreateDTO;
import com.appTest.store.dto.supplier.SupplierDTO;
import com.appTest.store.models.Supplier;

import java.util.List;

public interface ISupplierService {

    List<SupplierDTO> getAllSuppliers(Boolean includeDeleted);

    Supplier getSupplierById(Long id);
    SupplierDTO getSupplierDtoById(Long id);

    SupplierDTO createSupplier(SupplierCreateDTO dto);
    SupplierDTO updateSupplier(Long id, SupplierCreateDTO dto);

    // Ahora es "soft delete"
    void deleteSupplierById(Long id);

    // Nuevo: restaurar proveedor
    void restoreSupplier(Long id);

    SupplierDTO convertSupplierToDto(Supplier s);
}

