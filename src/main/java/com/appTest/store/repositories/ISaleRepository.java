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

   @Query("SELECT new com.appTest.store.dto.sale.SaleSummaryByDateDTO(s.dateSale, SUM(sd.quantity * sd.priceUni), COUNT(DISTINCT s.idSale)) " +
            "FROM Sale s JOIN s.saleDetailList sd WHERE s.dateSale = :date GROUP BY s.dateSale")
   SaleSummaryByDateDTO getSaleSummaryByDate(@Param("date") LocalDate date);

    @Query("SELECT new com.appTest.store.dto.sale.SaleHighestDTO(" +
            "s.client.name, s.client.surname, s.idSale, SIZE(s.saleDetailList), SUM(sd.quantity * sd.priceUni)) " +
            "FROM Sale s JOIN s.saleDetailList sd GROUP BY s.idSale, s.client.name, s.client.surname ORDER BY SUM(sd.quantity * sd.priceUni) DESC")
    List<SaleHighestDTO> getHighestSale();


    @Query("""
      select distinct s
      from Sale s
      left join fetch s.client c
      where (:from is null or s.dateSale >= :from)
        and (:to   is null or s.dateSale <= :to)
        and (:clientId is null or s.client.idClient = :clientId)
      order by s.dateSale desc, s.idSale desc
    """)
    List<Sale> search(@Param("from") LocalDate from, @Param("to") LocalDate to, @Param("clientId") Long clientId);

}
