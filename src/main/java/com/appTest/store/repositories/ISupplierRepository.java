package com.appTest.store.repositories;

import com.appTest.store.models.Supplier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ISupplierRepository extends JpaRepository<Supplier, Long> {

    boolean existsByDni(String dni);
    boolean existsByEmail(String email);

    Optional<Supplier> findByDni(String dni);
    Optional<Supplier> findByEmail(String email);
}
