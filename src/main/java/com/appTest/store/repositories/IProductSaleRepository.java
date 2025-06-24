package com.appTest.store.repositories;

import com.appTest.store.dto.productSale.ProductMostSoldDTO;
import com.appTest.store.models.SaleDetail;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IProductSaleRepository extends JpaRepository <SaleDetail, Long> {

    @Query("SELECT new com.appTest.bazar.dto.productSale.ProductMostSoldDTO(ps.product.name, SUM(ps.quantity)) " +
            "FROM ProductSale ps GROUP BY ps.product ORDER BY SUM(ps.quantity) DESC")
    List<ProductMostSoldDTO> getMostSoldProduct(org.springframework.data.domain.Pageable pageable);
}
