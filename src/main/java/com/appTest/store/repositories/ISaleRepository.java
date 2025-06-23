package com.appTest.store.repositories;

import com.appTest.store.dto.sale.SaleHighestDTO;
import com.appTest.store.dto.sale.SaleSummaryByDateDTO;
import com.appTest.store.models.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ISaleRepository extends JpaRepository <Sale, Long> {

    @Query("SELECT new com.appTest.bazar.dto.sale.SaleSummaryByDateDTO(s.dateSale, SUM(s.total), COUNT(s)) " +
            "FROM Sale s WHERE s.dateSale = :date GROUP BY s.dateSale")
    SaleSummaryByDateDTO getSaleSummaryByDate(@Param("date") LocalDate date);

    @Query("SELECT new com.appTest.bazar.dto.sale.SaleHighestDTO(" +
            "s.client.name, s.client.surname, s.idSale, SIZE(s.productSaleList), s.total) " +
            "FROM Sale s ORDER BY s.total DESC")
    List<SaleHighestDTO> getHighestSale();

}
