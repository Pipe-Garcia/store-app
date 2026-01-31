// src/main/java/com/appTest/store/repositories/IPurchaseRepository.java
package com.appTest.store.repositories;

import com.appTest.store.models.Purchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface IPurchaseRepository extends JpaRepository<Purchase, Long> {

    @Query("""
        select p from Purchase p
        left join fetch p.supplier s
        left join fetch p.purchaseDetails d
        left join fetch d.materialSupplier ms
        left join fetch ms.material m
        where p.idPurchase = :id
    """)
    Optional<Purchase> findFullById(@Param("id") Long id);

    @Query("""
        select distinct p from Purchase p
        left join fetch p.supplier s
        left join fetch p.purchaseDetails d
        where (:supplierId is null or s.idSupplier = :supplierId)
          and (:from is null or p.datePurchase >= :from)
          and (:to   is null or p.datePurchase <= :to)
        order by p.datePurchase desc, p.idPurchase desc
    """)
    List<Purchase> searchForReport(
            @Param("supplierId") Long supplierId,
            @Param("from") LocalDate from,
            @Param("to") LocalDate to
    );
}
