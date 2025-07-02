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

        @Query("SELECT new com.appTest.store.dto.material.MaterialStockAlertDTO(s.material.name, s.quantityAvailable) " +
                "FROM Stock s WHERE s.quantityAvailable < 5")
        List<MaterialStockAlertDTO> getMaterialsWithLowStock();


        @Query("SELECT new com.appTest.store.dto.material.MaterialMostExpensiveDTO(p.name, p.priceArs) " +
                "FROM Material p ORDER BY p.priceArs DESC")
        List<MaterialMostExpensiveDTO> getMaterialByHighestPrice();

}
