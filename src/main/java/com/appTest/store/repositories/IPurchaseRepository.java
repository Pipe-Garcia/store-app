// src/main/java/com/appTest/store/repositories/IPurchaseRepository.java
package com.appTest.store.repositories;

import com.appTest.store.models.Purchase;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

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
}

