package com.appTest.store.repositories;

import com.appTest.store.dto.stock.StockByWarehouseDTO;
import com.appTest.store.models.Stock;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface IStockRepository extends JpaRepository<Stock, Long> {

    Optional<Stock> findByMaterial_IdMaterialAndWarehouse_IdWarehouse(Long materialId, Long warehouseId);

    // 🔽 Agregado para buscar todos los stocks de un material específico
    List<Stock> findByMaterial_IdMaterial(Long idMaterial);

    // IStockRepository.java
    @Query("""
      select new com.appTest.store.dto.stock.StockByWarehouseDTO(
        s.warehouse.idWarehouse, s.warehouse.name, s.quantityAvailable
      )
      from Stock s
      where s.material.idMaterial = :materialId
      order by s.warehouse.name
    """)
    List<StockByWarehouseDTO> findByMaterialId(@Param("materialId") Long materialId);

}

