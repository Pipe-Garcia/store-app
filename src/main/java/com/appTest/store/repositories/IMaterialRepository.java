package com.appTest.store.repositories;

import com.appTest.store.dto.material.MaterialMostExpensiveDTO;
import com.appTest.store.dto.material.MaterialStockAlertDTO;
import com.appTest.store.models.Material;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.List;

@Repository
public interface IMaterialRepository extends JpaRepository <Material, Long> {

        @Query("SELECT new com.appTest.store.dto.material.MaterialStockAlertDTO(s.material.name, s.quantityAvailable) " +
                "FROM Stock s WHERE s.quantityAvailable < 10")
        List<MaterialStockAlertDTO> getMaterialsWithLowStock();


        @Query("SELECT new com.appTest.store.dto.material.MaterialMostExpensiveDTO(p.name, p.priceArs) " +
                "FROM Material p ORDER BY p.priceArs DESC")
        List<MaterialMostExpensiveDTO> getMaterialByHighestPrice();


        @Query("""
            select m from Material m
            where (coalesce(:q,'') = '' 
                   or lower(m.name) like lower(concat('%', :q, '%'))
                   or lower(m.brand) like lower(concat('%', :q, '%'))
                   or lower(m.internalNumber) like lower(concat('%', :q, '%'))
                   or lower(coalesce(m.description,'')) like lower(concat('%', :q, '%')))
              and (:familyId is null or m.family.idFamily = :familyId)
              and (:minPrice is null or m.priceArs >= :minPrice)
              and (:maxPrice is null or m.priceArs <= :maxPrice)
            order by m.name
          """)
        List<Material> search(@Param("q") String q,
                              @Param("familyId") Long familyId,
                              @Param("minPrice") BigDecimal minPrice,
                              @Param("maxPrice") BigDecimal maxPrice);
}
