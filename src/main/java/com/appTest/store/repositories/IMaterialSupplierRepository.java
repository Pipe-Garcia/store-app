package com.appTest.store.repositories;

import com.appTest.store.models.MaterialSupplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface IMaterialSupplierRepository extends JpaRepository <MaterialSupplier, Long> {
}
