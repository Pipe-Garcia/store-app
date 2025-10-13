package com.appTest.store.repositories;

import com.appTest.store.models.MaterialSupplier;
import com.appTest.store.models.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IMaterialSupplierRepository extends JpaRepository<MaterialSupplier, Long> {


    List<MaterialSupplier> findBySupplier(Supplier supplier);

    void deleteBySupplier(Supplier supplier);


    List<MaterialSupplier> findBySupplier_IdSupplier(Long supplierId);
}
