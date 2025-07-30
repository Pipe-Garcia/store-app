package com.appTest.store.services;

import com.appTest.store.dto.supplier.SupplierCreateDTO;
import com.appTest.store.dto.supplier.SupplierDTO;
import com.appTest.store.dto.supplier.SupplierUpdateDTO;
import com.appTest.store.models.Supplier;

import java.util.List;

public interface ISupplierService {
    List<Supplier> getAllSuppliers();
    Supplier getSupplierById(Long id);
    SupplierDTO convertSupplierToDto(Supplier supplier);
    SupplierDTO createSupplier(SupplierCreateDTO dto);
    void updateSupplier(SupplierUpdateDTO dto);
    void deleteSupplierById(Long id);
}
