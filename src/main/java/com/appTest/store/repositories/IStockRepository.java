package com.appTest.store.repositories;

import com.appTest.store.models.Stock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IStockRepository extends JpaRepository<Stock, Long> {

    Optional<Stock> findByMaterial_IdMaterialAndWarehouse_IdWarehouse(Long materialId, Long warehouseId);

    // 🔽 Agregado para buscar todos los stocks de un material específico
    List<Stock> findByMaterial_IdMaterial(Long idMaterial);
}

