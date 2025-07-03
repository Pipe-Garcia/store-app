package com.appTest.store.repositories;

import com.appTest.store.dto.material.MaterialMostExpensiveDTO;
import com.appTest.store.dto.material.MaterialStockAlertDTO;
import com.appTest.store.models.Material;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IMaterialRepository extends JpaRepository <Material, Long> {

        @Query("SELECT new com.appTest.store.dto.material.MaterialStockAlertDTO(p.name, p.quantityAvailable) " +
                "FROM Material p WHERE p.quantityAvailable < 5")
        List<MaterialStockAlertDTO> getMaterialsWithLowStock();


        @Query("SELECT new com.appTest.store.dto.material.MaterialMostExpensiveDTO(p.name, p.price) " +
                "FROM Material p ORDER BY p.price DESC")
        List<MaterialMostExpensiveDTO> getMaterialByHighestPrice();

}
