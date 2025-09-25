package com.appTest.store.repositories;

import com.appTest.store.dto.saleDetail.MaterialMostSoldDTO;
import com.appTest.store.models.SaleDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ISaleDetailRepository extends JpaRepository <SaleDetail, Long> {

    @Query("SELECT new com.appTest.store.dto.saleDetail.MaterialMostSoldDTO(ps.material.name, SUM(ps.quantity)) " +
            "FROM SaleDetail ps GROUP BY ps.material ORDER BY SUM(ps.quantity) DESC")
    List<MaterialMostSoldDTO> getMostSoldMaterial(org.springframework.data.domain.Pageable pageable);

    // IMPORTANTE: suma este metodo
    @Query("""
    select sd
    from SaleDetail sd
    join fetch sd.material m
    where sd.sale.idSale = :saleId
    """)
    List<SaleDetail> findBySaleIdWithMaterial(@Param("saleId") Long saleId);
}
