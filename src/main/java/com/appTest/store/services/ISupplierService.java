package com.appTest.store.services;

import com.appTest.store.dto.supplier.SupplierCreateDTO;
import com.appTest.store.dto.supplier.SupplierDTO;
import com.appTest.store.models.Supplier;

import java.util.List;

public interface ISupplierService {

    // ✅ Devuelve lista de DTOs, no entidades
    List<SupplierDTO> getAllSuppliers();

    Supplier getSupplierById(Long id);

    // ✅ Si se usa desde el Service y se necesita en el controlador
    SupplierDTO convertSupplierToDto(Supplier supplier);

    SupplierDTO getSupplierDtoById(Long id);

    SupplierDTO createSupplier(SupplierCreateDTO dto);

    // ✅ Ya lo tenías bien, pero faltaba devolver un DTO
    SupplierDTO updateSupplier(Long id, SupplierCreateDTO dto);

    void deleteSupplierById(Long id);
}
