package com.appTest.bazar.repositories;

import com.appTest.bazar.dto.product.ProductMostExpensiveDTO;
import com.appTest.bazar.dto.product.ProductStockAlertDTO;
import com.appTest.bazar.models.Product;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IProductRepository extends JpaRepository <Product, Long> {

        @Query("SELECT new com.appTest.bazar.dto.product.ProductStockAlertDTO(p.name, p.quantityAvailable) " +
                "FROM Product p WHERE p.quantityAvailable < 5")
        List<ProductStockAlertDTO> getProductsWithLowStock();


        @Query("SELECT new com.appTest.bazar.dto.product.ProductMostExpensiveDTO(p.name, p.price) " +
                "FROM Product p ORDER BY p.price DESC")
        List<ProductMostExpensiveDTO> getProductByHighestPrice();

}
