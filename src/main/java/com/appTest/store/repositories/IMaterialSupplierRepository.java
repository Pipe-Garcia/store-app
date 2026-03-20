package com.appTest.store.repositories;

import com.appTest.store.models.MaterialSupplier;
import com.appTest.store.models.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IMaterialSupplierRepository extends JpaRepository<MaterialSupplier, Long> {

    List<MaterialSupplier> findBySupplier(Supplier supplier);

    void deleteBySupplier(Supplier supplier);

    List<MaterialSupplier> findBySupplier_IdSupplier(Long supplierId);

    @Query("""
        select ms
        from MaterialSupplier ms
        join fetch ms.supplier s
        where ms.material.idMaterial = :materialId
        order by ms.priceUnit asc, s.nameCompany asc, s.surname asc, s.name asc
    """)
    List<MaterialSupplier> findByMaterialIdWithSupplier(@Param("materialId") Long materialId);
}
