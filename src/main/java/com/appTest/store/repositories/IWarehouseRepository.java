// src/main/java/com/appTest/store/repositories/IWarehouseRepository.java
package com.appTest.store.repositories;

import com.appTest.store.models.Warehouse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface IWarehouseRepository extends JpaRepository<Warehouse, Long> {

    @Query("""
        select w
        from Warehouse w
        left join fetch w.stockList s
        left join fetch s.material m
        where w.idWarehouse = :id
    """)
    Optional<Warehouse> findFullById(@Param("id") Long id);
}
