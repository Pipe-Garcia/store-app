package com.appTest.store.repositories;

import com.appTest.store.models.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ISupplierRepository extends JpaRepository <Supplier, Long> {
}
