package com.appTest.store.repositories;

import com.appTest.store.dto.sale.PaymentStatusAggDTO;
import com.appTest.store.dto.sale.SaleHighestDTO;
import com.appTest.store.dto.sale.SaleSummaryByDateDTO;
import com.appTest.store.models.Sale;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
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


    // total a cobrar (sum(balance)) donde balance > 0
    // balance(s) = totalVenta(s) - totalPagos(s)
    @Query("""
      select coalesce(sum(
        (select coalesce(sum(sd.priceUni * sd.quantity), 0)
          from SaleDetail sd
          where sd.sale = s)
        -
        (select coalesce(sum(p.amount), 0)
          from Payment p
          where p.sale = s)
      ), 0)
      from Sale s
      where
        ((select coalesce(sum(sd.priceUni * sd.quantity), 0)
            from SaleDetail sd
            where sd.sale = s)
        -
        (select coalesce(sum(p.amount), 0)
            from Payment p
            where p.sale = s)) > 0
    """)
    BigDecimal sumReceivablesTotal();

    @Query("""
      select count(s)
      from Sale s
      where
        ((select coalesce(sum(sd.priceUni * sd.quantity), 0)
            from SaleDetail sd
            where sd.sale = s)
        -
        (select coalesce(sum(p.amount), 0)
            from Payment p
            where p.sale = s)) > 0
    """)
    Long countReceivables();

    // Top clientes del mes (ya estaba OK; lo dejo igual)
    @Query("""
      select new com.appTest.store.dto.dashboard.TopClientDTO(
        c.idClient,
        concat(coalesce(c.name,''),' ',coalesce(c.surname,'')),
        coalesce(sum(sd.priceUni * sd.quantity), 0)
      )
      from Sale s
      join s.client c
      join s.saleDetailList sd
      where s.dateSale between :from and :to
      group by c.idClient, c.name, c.surname
      order by sum(sd.priceUni * sd.quantity) desc
    """)
    List<com.appTest.store.dto.dashboard.TopClientDTO>
    topClientsBetween(java.time.LocalDate from, java.time.LocalDate to);


    @Query("""
      select new com.appTest.store.dto.sale.SaleSummaryByDateDTO(
        s.dateSale,
        sum(sd.priceUni * sd.quantity),
        count(distinct s.idSale)
      )
      from Sale s join s.saleDetailList sd
      where s.dateSale between :from and :to
      group by s.dateSale
      order by s.dateSale
    """)
    List<com.appTest.store.dto.sale.SaleSummaryByDateDTO> sumByDateBetween(
        @Param("from") java.time.LocalDate from,
        @Param("to")   java.time.LocalDate to);


}
